'use strict';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || '';

const startBot = require('./src/index.js');
startBot(DISCORD_TOKEN).then(null, console.error);
