'use strict';
window.ChessClock=class{
 constructor(seconds,onFlag,onTick){this.left={w:seconds*1000,b:seconds*1000};this.enabled=seconds>0;this.onFlag=onFlag;this.onTick=onTick;this.active=null;this.stamp=performance.now();this.stopped=false;this.id=setInterval(()=>this.update(),100);}
 update(){if(this.stopped)return;const now=performance.now(),elapsed=Math.max(0,now-this.stamp);this.stamp=now;if(this.active&&this.enabled){const side=this.active;this.left[side]=Math.max(0,this.left[side]-elapsed);if(!this.left[side]){this.active=null;this.onFlag(side);}}this.onTick(this.left,this.active,this.enabled);}
 switch(side){this.update();if(this.stopped||(this.enabled&&(this.left.w<=0||this.left.b<=0)))return;this.active=side;this.stamp=performance.now();this.onTick(this.left,this.active,this.enabled);}
 restore(state,elapsedMs=0){this.enabled=state.enabled;this.left={...state.left};this.active=state.active;if(this.active&&this.enabled)this.left[this.active]=Math.max(0,this.left[this.active]-Math.max(0,elapsedMs));this.stamp=performance.now();this.update();}
 stop(){if(this.stopped)return;this.update();this.active=null;this.stopped=true;clearInterval(this.id);this.onTick(this.left,null,this.enabled);}
};
