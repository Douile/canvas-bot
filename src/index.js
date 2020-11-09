'use strict';

const { Client } = require('discord.js-light');
const sqlite3 = require('sqlite3');
const Canvas = require('./canvas.js');
const { getWeekTimes } = require('./utils.js');
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

function awaitOpen(database) {
  return new Promise((resolve, reject) => {
    database.once('error', reject);
    database.once('open', resolve);
  });
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
      value: config
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
