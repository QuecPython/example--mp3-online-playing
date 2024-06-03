//app.js
import mqtt from './utils/mqtt.js';
// 导包
const Base64 = require('./lib/Base64.js');
const Crypto = require('./lib/Crypto.js');
const crypto = require('./utils/hex_hmac_sha1.js');
var mqttclient;


function get_playlist(){
 GetCloudMusicList();
}

function signHmacSha1(params, deviceSecret) {

    let keys = Object.keys(params).sort();
    // Sort in lexicographical order
    keys = keys.sort();
    const list = [];
    keys.map((key) => {
      list.push(`${key}${params[key]}`);
    });
    const contentStr = list.join('');
    return crypto.hex_hmac_sha1(deviceSecret, contentStr);
  }

function initMqttOptions(deviceConfig) {

    const params = {
      productKey: deviceConfig.productKey,
      deviceName: deviceConfig.deviceName,
      timestamp: Date.now(),
      clientId: Math.random().toString(36).substr(2),
    }
    //CONNECT argument
    const options = {
      keepalive: 60, //60s
      clean: true, //cleanSession does not maintain durable sessions
      protocolVersion: 4 //MQTT v3.1.1
    }
    //1.create clientId，username，password
    options.password = signHmacSha1(params, deviceConfig.deviceSecret);
    options.clientId = `${params.clientId}|securemode=2,signmethod=hmacsha1,timestamp=${params.timestamp}|`;
    options.username = `${params.deviceName}&${params.productKey}`;

    return options;
  }

function GetCloudMusicList() {
    const publish_data = {
        "id": 1002,
        "params": {
                "version": "V1",
                "module": "EC600G"
            }
        };
        const publish_data_1 = {
            "id": 1005,
            "version": "V1",
            "params": {
                "module": "EC600G",
            },
            "method": "thing.ota.firmware.get"
        }
        const music_list_topic = "/ota/device/inform/a1A5W32fexl/WeChatDev";
        const music_list_topic_1 = "/sys/a1A5W32fexl/WeChatDev/thing/ota/firmware/get";
        mqttclient.publish(music_list_topic, JSON.stringify(publish_data));
        mqttclient.publish(music_list_topic_1, JSON.stringify(publish_data_1));
}

function get_contents_v1(payload){
    const playlist = [];
    for(let i=0, j=payload["data"]["files"].length; i<j; i++){
        let data = payload["data"]["files"][i];
        let file_name = data["fileName"].replace("bin", "mp3");
        let file_path = data["fileUrl"]
        let audio_infor = {
          'file_name': file_name, 'file_path': file_path, 'upload_time': "",'file_size': data["fileSize"],
            'play_status': 0
            };
        playlist.push(audio_infor);
        }
    console.log(playlist);
    return playlist
}

function CloudCb(topic, payload) {
    console.log("rev:" + [topic, payload].join(": "));
    if (topic.endsWith("ota/firmware/get_reply")) {
        payload = JSON.parse(payload);
        wx.setStorage({
            key: "playlist",
            data: get_contents_v1(payload)
          });
      }
    else {
        payload = JSON.parse(payload);
        if(payload['code'] == 'done'){
            var pages = getCurrentPages();
            var that = pages[pages.length - 1]
            // 音频播放完成
            const playlist = that.data.playlist;
            const playinfor = that.data.playinfor;
            // 播放状态
            if(playinfor['playid']){
              playlist[playinfor['playid']]['play_status'] = 0;
            }
            // 播放音频信息
            playinfor['playname'] = '';
            playinfor['playid'] = '';
            playinfor['playstatus'] = false;
            //
            that.setData({
              playlist: playlist
            });
        }
    }
}

App({
  onLaunch: function () {
    console.log('------ QuecPython streaming audio playback ------')
    this.get_playlist = get_playlist;
    // Trying to connect to mqtt
    const deviceConfig = {
            productKey: "a1A5W32fexl",
            deviceName: "WeChatDev",
            deviceSecret: "aadcd2b1e1ff0950c1df13feb6d499da",
            regionId: "cn-shanghai"
        };
    const options = initMqttOptions(deviceConfig);
    const url = "wxs://a1A5W32fexl.iot-as-mqtt.cn-shanghai.aliyuncs.com";
    console.log(options);
    console.log(url);
    mqttclient = mqtt.connect(url, options);
    this.mqttclient = mqttclient;
    mqttclient.on('connect', function(){
        console.log('Connecting to MQTT succeeded');
        mqttclient.on('message', function(topic, payload) {
            CloudCb(topic, payload);
        });
        mqttclient.subscribe('/a1A5W32fexl/WeChatDev/user/pub', function(err){
                if (!err) {
                  console.log('Subscribe successfully');
                }
            });
        mqttclient.subscribe('/ota/device/upgrade/a1A5W32fexl/WeChatDev', function(err){
                if (!err) {
                  console.log('Subscribe successfully');
                }
            });
        mqttclient.subscribe('/sys/a1A5W32fexl/WeChatDev/thing/ota/firmware/get_reply', function(err){
                if (!err) {
                  console.log('Subscribe successfully');
                }
            });
        // http request to get playlist
        get_playlist();
    });
    }
})
