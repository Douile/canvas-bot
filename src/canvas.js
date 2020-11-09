const fetch = require("node-fetch");

const TOKEN = process.env.CANVAS_TOKEN || "";
const API = "https://liverpool.instructure.com/api/v1";
const WEBHOOK = process.env.WEBHOOK || "";
const COURSE_FILTER = '202021-COMP';
const PAGE_LENGTH = 50;

const MS_DAY = 1000 * 60 * 60 * 24;
const MS_WEEK = MS_DAY*7;

const RE_LINKURL = /\<([^\>]+)\>/g;
const RE_LINKREL = /rel=\"([^"]+)\"/g;

let bucket = { remaining: undefined };

const req = Object.freeze({
  'get': async function(url, auth, headers) {
    if (!headers) headers = {};
    headers['Authorization'] = `Bearer ${auth}`;
    console.log('GET', String(url));
    const res = await fetch(url, {headers});
    bucket.remaining = parseFloat(res.headers.get('X-Rate-Limit-Remaining'));
    return res;
  },
  'getJson': async function(url, auth, headers) {
    const res = await req.get(url, auth, headers);
    if (res.ok) return await res.json();
    throw new Error(`Fetch error ${res.status} ${res.statusText}`);
  },
  'getPaginated': async function(url, auth, headers) {
    if (!(url instanceof URL)) {
      url = new URL(url);
    }
    url.searchParams.set('page', '1');
    url.searchParams.set('per_page', PAGE_LENGTH);
    let responses = [];
    while (true) {
      const res = await req.get(url, auth, headers);
      if (!res.ok) throw new Error(`Fetch error ${res.status} ${res.statusText}`);
      responses.push(await res.json());
      let links = parseLinks(res.headers.get('Link'));

      if ('next' in links) {
        url = links.next;
      } else {
        break;
      }
      if (links.current === links.last) break;
    }
    return responses.flat();
  }
});

function parseLinks(linkString) {
  let links = {}, linkStrings = linkString.split(',');
  for (link of linkStrings) {
    let [ url, rel ] = link.split(';');
    RE_LINKURL.lastIndex = 0;
    let urlMatch = RE_LINKURL.exec(url);
    if (urlMatch === null) continue;
    RE_LINKREL.lastIndex = 0;
    let relMatch = RE_LINKREL.exec(rel);
    if (relMatch === null) continue;
    links[relMatch[1]] = urlMatch[1];
  }
  return links;
}

async function getCourses() {
  return req.getJson(`${API}/courses`, TOKEN);
}

async function getCourseTodo(courseID) {
  return req.get(`${API}/courses/${courseID}/todo`, TOKEN);
}

async function getCourseAssignments(courseID) {
  const assignments = await req.getPaginated(`${API}/courses/${courseID}/assignments`, TOKEN);
  return assignments.map(a => {
    let due = Date.parse(a.due_at);
    let dueDate = new Date();
    dueDate.setTime(due);
    return {id: a.id, name: a.name, course: a.course_id, desc: a.description, due, dueDate , points: a.points_possible, url: a.html_url };
  });
}

async function getCourseDiscussions(courseID) {
  const discussions = await req.getPaginated(`${API}/courses/${courseID}/discussion_topics`, TOKEN);
  return discussions.filter(d => d.lock_at !== null).map(d => {
    let due = Date.parse(d.lock_at);
    dueDate = new Date();
    dueDate.setTime(due);
    return {id: d.id, name: d.title, course: courseID, desc: d.message, due, dueDate, points: 0, url: d.html_url };
  })
}

async function getCalenderEvents(contexts, startDate, endDate) {
  let url = new URL(`${API}/calendar_events`);
  url.searchParams.append('context_codes[]', contexts.join(','));
  url.searchParams.append('type', 'event');
  url.searchParams.append('start_date', startDate);
  url.searchParams.append('end_date', endDate);
  url.searchParams.append('per_page', '5');
  url.searchParams.append('excludes[]', 'description,child_events,assignment');
  return await req.get(url, TOKEN);
}

async function plannerEvents(contexts, startDate, endDate, filter) {
  let url = new URL(`${API}/planner/items`);
  url.searchParams.append('context_codes[]', contexts.join(','));
  url.searchParams.append('start_date', startDate);
  url.searchParams.append('end_date', endDate);
  url.searchParams.append('per_page', '50');
  if (filter) url.searchParams.append('filter', 'ungraded_todo_items');
  return req.get(url, TOKEN);
}

function getWeekTimes() {
  let start = new Date();
  start.setUTCMilliseconds(0);
  start.setUTCSeconds(0);
  start.setUTCMinutes(0);
  start.setUTCHours(0);
  start = start.getTime() - ((start.getDay()-1) * MS_DAY);
  end = start + (MS_WEEK);
  return { start, end };
}

async function main() {
  let courses = await getCourses();
  let importantCourses = courses.filter(course => course.name.startsWith(COURSE_FILTER));
  let courseNames = {};
  for (let course of importantCourses) {
    let start = course.name.indexOf('-')+1;
    courseNames[course.id] = course.name.substring(start, course.name.indexOf(' '));
  }
  console.log(courseNames);
  console.log(`Identified ${importantCourses.length} courses`);
  let { start, end } = getWeekTimes();

  const length = importantCourses.length
  let promises = new Array(length*2);
  for (let i=0;i<length;i++) {
    promises[i] = getCourseAssignments(importantCourses[i].id);
    promises[i+length] = getCourseDiscussions(importantCourses[i].id);
  }
  let assignments = await Promise.all(promises);
  let now = new Date();
  assignments = assignments.flat().filter(a => a.due >= start && a.due <= end).sort((a,b) => a.due - b.due);
  for (let ass of assignments) {
    console.log(`[${ass.id}] ${ass.due} ${ass.dueDate.toUTCString()} ${courseNames[ass.course]} ${ass.name} - ${ass.points}`);
  }
  const fields = assignments.map(a => {return {name: courseNames[a.course], value: `[${a.name}](${a.url})\nDue: ${a.dueDate.toUTCString()}\nPoints: ${a.points}`, inline: false}});
  let res = await fetch(WEBHOOK, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({content:'@everyone',embeds:[{
    title: 'Upcoming assignments',
    color: 0xff0000,
    fields: fields,
    footer: { text: 'Week starting' },
    timestamp: new Date(start).toISOString()
  }]})});
  console.log(res.status);
}

if (TOKEN.length === 0 || WEBHOOK.length === 0) {
	console.error('Must define token and webhook');
	process.exit(1);
}
console.log(`Running as ${process.getuid()}`);
main().then(console.log,console.error);
