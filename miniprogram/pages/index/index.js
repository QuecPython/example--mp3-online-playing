//index.js
const app = getApp()
// Save the playback information and send mqtt message
function play_send_mqtt(playinfor, playlist, play_id, that){
  // Play state
  if(playinfor['playid']){
    playlist[playinfor['playid']]['play_status'] = 0;
  }
  playlist[play_id]['play_status'] = 1;
  // Play audio information
  playinfor['playname'] = playlist[play_id]['file_name'];
  playinfor['playid'] = play_id;
  playinfor['playstatus'] = true;
  // mqtt sends messages
  const senddata = {
    'data': playlist[play_id],
    'command': 'play'
  };
  app.mqttclient.publish('/a1A5W32fexl/WeChatDev/user/wechat_sub', JSON.stringify(senddata));
  console.log('Send mqtt message, play:'+playlist[play_id].file_name);
  that.setData({
    playlist: playlist
  });
}
// Save the playback information and send mqtt message
function stop_send_mqtt(playinfor, playlist, play_id, that){
  playlist[play_id]['play_status'] = 0;
  // The audio information is left blank
  playinfor['playname'] = playlist[play_id]['file_name'];
  playinfor['playid'] = play_id;
  playinfor['playstatus'] = true;
  // mqtt sends messages
  const senddata = {
    'data': playlist[play_id],
    'command': 'stop'
  }
  app.mqttclient.publish('/a1A5W32fexl/WeChatDev/user/wechat_sub', JSON.stringify(senddata));
  console.log('Send mqtt message, stop:'+(playlist[play_id].file_name));
  that.setData({
    playlist: playlist
  });
}

Page({
  data: {
    playlist: [],
    playinfor: {
      'playname': '',
      'playid': '',
      'playstatus': false
    } // Music play information
  },

  onLoad: function() {
    // Loading the page is getting the cached playlist data and updating it
    var that = this;
    wx.getStorage({
      key: 'playlist',
      success (res) {
        console.log(res.data)
        that.setData({
          playlist: res.data
        })
      }
    })
  },

  play: function (e) {
    var play_id = e.currentTarget.id; // Current music subscript
    const playlist = this.data.playlist; // playlist
    const playinfor = this.data.playinfor; // The currently playing audio information
    const that = this;
    if(playinfor['playstatus']){
      // If the time is playing, prompt
      wx.showModal({
        title: 'Tips',
        content: 'Be playing:'+playinfor['playname']+', Whether to switch to：'+playlist[play_id]['file_name']+'?',
        success: function (res) {
          if (res.confirm) {
            play_send_mqtt(playinfor, playlist, play_id, that);
          } else {
            // Here is after clicking Cancel
            return
          }
        }
      })
    }else{
      play_send_mqtt(playinfor, playlist, play_id, that)
    }
  },

  onPullDownRefresh: function() {
    // Pull down to refresh the playlist
    const playinfor = this.data.playinfor; // The message is playing
    var that = this;
    app.get_playlist();
    wx.getStorage({
      key: 'playlist',
      success (res) {
        // console.log(res.data)
        that.setData({
          playlist: res.data
        })
        stop_send_mqtt(playinfor, res.data, playinfor['playid'], that)
      }
    })
  },

  stop: function (e) {
    var play_id = e.currentTarget.id;  // Current music subscript
    const playlist = this.data.playlist; // playlist
    const playinfor = this.data.playinfor; // The message is playing
    const that = this;
    if(playinfor['playstatus']){
      // When there is a play message
      wx.showModal({
        title: 'Tips',
        content: 'Be playing:'+playinfor['playname']+', Whether to stop playing？',
        success: function (res) {
          if (res.confirm) {//Here is after clicking OK
            stop_send_mqtt(playinfor, playlist, play_id, that);
          } else {//Here is after clicking Cancel
            return
          }
        }
      })
    }
  },

  continue: function (e) {
    var play_id = e.currentTarget.id;  // Current music subscript
    const playlist = this.data.playlist; // playlist
    const playinfor = this.data.playinfor; // The message is playing
    const that = this;
    if(!playinfor['playstatus']){
      // In suspended state
      wx.showModal({
        title: 'Tips',
        content: 'Whether to continue playing:'+playinfor['playname'],
        success: function (res) {
          if (res.confirm) {//Here is after clicking OK
            continue_send_mqtt(playinfor, playlist, play_id, that);
          } else { //Here is after clicking Cancel
            return
          }
        }
      })
    }
  },

})



