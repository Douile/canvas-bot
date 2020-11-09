'use strict';

const { Client } = require('discord.js-light');

const BOT_PERMISSIONS = [
  'SEND_MESSAGES',
  'MENTION_EVERYONE',
  'EMBED_LINKS',
  'ATTACH_FILES',
];

const client = new Client({
  cacheGuilds: false,
	cacheChannels: false,
	cacheOverwrites: false,
	cacheRoles: false,
	cacheEmojis: false,
	cachePresences: false,
  presence: { status: 'online', activity: { type: 'WATCHING', name: 'canvas' }}
});

client.on('ready', function() {
  console.log(`Logged in as ${client.user.username}`);
  client.generateInvite({permissions:BOT_PERMISSIONS}).then(link => console.log(`Invite link ${link}`), console.error);
});

module.exports = async function(token) {
  await client.login(token);
  return client;
}
