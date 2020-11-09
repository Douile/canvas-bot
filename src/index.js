'use strict';

const { performance } = require('perf_hooks');
const { Client } = require('discord.js-light');
const sqlite3 = require('sqlite3');
const Canvas = require('./canvas.js');
const { getWeekTimes, asyncWrap } = require('./utils.js');
const { BOT_PERMISSIONS, BOT_PRESENCE, DB_NAME } = require('./constants.js');

const UPDATE_TIME = 15 * 60 * 1000;
let LAST_UPDATE;
let CACHE;

const client = new Client({
  cacheGuilds: false,
	cacheChannels: false,
	cacheOverwrites: false,
	cacheRoles: false,
	cacheEmojis: false,
	cachePresences: false,
  presence: BOT_PRESENCE
});

client.on('ready', function() {
  console.log(`Logged in as ${client.user.username}`);
  client.generateInvite({permissions:BOT_PERMISSIONS}).then(link => console.log(`Invite link ${link}`), console.error);
});

client.on('message', asyncWrap(async function(message) {
  if (message.author.bot) return;
  if (!message.content.startsWith(client.config.prefix)) return;
  const parts = message.content.substring(client.config.prefix.length).trim().split(' ');
  const command = parts.splice(0, 1)[0];

  let offset;
  switch(command) {
    case 'nextweek':
    offset = 1;
    case 'thisweek':
    const embed = await generateAssignmentsEmbed(offset);
    await message.channel.send({ embed });
    break;
  }
}));

client.on('close', function() {
  client.db.close();
})

function awaitOpen(database) {
  return new Promise((resolve, reject) => {
    database.once('error', reject);
    database.once('open', resolve);
  });
}

async function getCoursesAndAssignments() {
  const courses = await client.canvas.getFilteredCourses();
  let promises = [];
  for (let courseID in courses) {
    promises.push(client.canvas.getCourseAssignments(courseID));
    promises.push(client.canvas.getCourseDiscussions(courseID));
  }
  const assignments = (await Promise.all(promises)).flat();
  return { courses, assignments };
}

async function getCoursesAndAssignmentsCached() {
  const now = performance.now();
  if (isNaN(LAST_UPDATE) || CACHE === undefined || now - LAST_UPDATE >= UPDATE_TIME) {
    CACHE = await getCoursesAndAssignments();
    LAST_UPDATE = now;
  }
  return CACHE;
}

async function getWeeksAssignments(offset) {
  const weekTimes = getWeekTimes(offset);
  let { courses, assignments } = await getCoursesAndAssignmentsCached();
  return { courses, assignments: assignments.concat(parseAssignmentOverrides(weekTimes.start, courses)).filter(a => a.due >= weekTimes.start && a.due <= weekTimes.end ).sort((a,b) => a.due - b.due), weekTimes };
}

function parseAssignmentOverrides(startTime, courses) {
  return client.config.overrides.map(o => {
    courses[o.course] = o.course;
    const due = startTime + o.offset;
    let dueDate = new Date();
    dueDate.setTime(due);
    return {
      id: `override-${o.name}`,
      name: o.name,
      course: o.course,
      desc: '',
      due, dueDate,
      points: o.points,
      url: ''
    };
  });
}

async function generateAssignmentsEmbed(offset) {
  const { courses, assignments, weekTimes } = await getWeeksAssignments(offset);
  const startDate = new Date();
  startDate.setTime(weekTimes.start);
  return {
    title: 'Upcoming assignments',
    color: 0xff0000,
    footer: { text: 'Week starting' },
    timestamp: startDate.toISOString(),
    fields: assignments.map(a => {
      return {
        name: courses[a.course],
        value: `[${a.name}](${a.url})\nDue: ${a.dueDate.toUTCString()}\nPoints: ${a.points}`,
        inline: false
      }
    })
  };
}

module.exports = async function(botToken, canvasToken, config) {
  const db = new sqlite3.Database(DB_NAME, sqlite3.OPEN_READWRITE);
  await awaitOpen(db);
  db.on('error', console.error);
  Object.defineProperties(client, {
    config: {
      configurable: false,
      enumerable: false,
      writable: false,
      value: Object.freeze(config)
    },
    canvas: {
      configurable: false,
      enumerable: false,
      writable: false,
      value: new Canvas(canvasToken, config)
    },
    db: {
      configurable: false,
      enumerable: false,
      writable: false,
      value: db
    }
  });
  await client.login(botToken);
  return client;
}
