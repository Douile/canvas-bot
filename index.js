/*
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
}*/
