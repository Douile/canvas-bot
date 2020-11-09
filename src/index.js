'use strict';

const { Client } = require('discord.js-light');
const sqlite3 = require('sqlite3');
const Canvas = require('./canvas.js');
const { getWeekTimes, asyncWrap } = require('./utils.js');
const { BOT_PERMISSIONS, BOT_PRESENCE, DB_NAME } = require('./constants.js');

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

  switch(command) {
    case 'thisweek': {
      const embed = await generateAssignmentsEmbed();
      await message.channel.send({ embed });
      break;
    }
    case 'nextweek': {
      const embed = await generateAssignmentsEmbed(1);
      await message.channel.send({ embed });
      break;
    }
  }
}));

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

async function getWeeksAssignments(offset) {
  const weekTimes = getWeekTimes(offset);
  const { courses, assignments } = await getCoursesAndAssignments();
  return { courses, assignments: assignments.filter(a => a.due >= weekTimes.start && a.due <= weekTimes.end ), weekTimes };
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
    fields: assignments.sort((a,b) => a.due - b.due).map(a => {
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
