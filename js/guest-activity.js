(() => {
 'use strict';
 function createGuestActivity(now=Date.now){
  let last=now();
  return {record(){last=now();},signal(visible){return {visible,activityAgeMs:Math.max(0,now()-last)};}};
 }
 if(typeof module!=='undefined')module.exports={createGuestActivity};
 else window.createGuestActivity=createGuestActivity;
})();
