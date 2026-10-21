'use strict';
self.window=self;
importScripts('chess.js','bot.js');
self.onmessage=event=>{try{const game=new Chess(event.data.fen);self.postMessage({move:chooseBotMove(game,event.data.level)});}catch(error){self.postMessage({error:String(error.message||error)});}};
