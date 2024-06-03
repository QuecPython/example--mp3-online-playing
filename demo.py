# Copyright (c) Quectel Wireless Solution, Co., Ltd.All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import audio
import ujson
import sys_bus
import request
import _thread
import utime
from aLiYun import aLiYun
from machine import Pin


class ALiYunManage(object):
    """
    Aliyun Cloud Connection
    """
    def __init__(self):
        self.pk = None
        self.ps = None
        self.dn = None
        self.ds = None
        self.client_id = None
        self.keep_alive = 300
        self.clean_session = False
        self.ali_obj = None
        self.params_init_status = False

    def parameter_initialization(self, product_key, product_secret, device_name, device_secret, client_id):
        """
        Initialize Aliyun connection parameters
        """
        self.pk = product_key
        self.ps = product_secret
        self.dn = device_name
        self.ds = device_secret
        self.client_id = client_id
        self.params_init_status = True

    def callback(self, topic, data):
        """
        event callback
        """
        data = data.decode()
        json_data = ujson.loads(data)
        command = json_data.get("command")
        print("command :", command)
        if command == "play":
            sys_bus.publish("stop_audio_play", json_data)
            sys_bus.publish("play_music", json_data)
        elif command == "stop":
            sys_bus.publish("stop_music", "")
            sys_bus.publish("stop_audio_play", json_data)

    def aliyun_connect(self):
        """
        connect to aliyun iot
        """
        if not self.params_init_status:
            print("please check params init")
            return False
        self.ali_obj = aLiYun(self.pk, self.ps, self.dn, self.ds)
        state = self.ali_obj.setMqtt(self.client_id, clean_session=self.clean_session, keepAlive=self.keep_alive)
        if state == -1:
            print("connect aliyun fail")
            return False
        self.ali_obj.setCallback(self.callback)

    def subscribe(self, topic, qos=0):
        """
        subscribe topic
        """
        if self.ali_obj:
            self.ali_obj.subscribe(topic, qos)
            return True
        else:
            return False

    def publish(self, topic, msg):
        """
        pulish msg
        """
        if self.ali_obj:
            self.ali_obj.publish(topic, msg)
            return True
        else:
            return False

    def disconnect(self):
        """
        close server connection
        """
        if self.ali_obj:
            self.ali_obj.disconnect()
            return True
        else:
            return False

    def loop_forever(self):
        if self.ali_obj:
            self.ali_obj.start()
            return True
        else:
            return False


class CreateThreadTask(object):
    """Create thread"""
    @staticmethod
    def create_thread(function_task, argument, size=8*1024):
        # Set the thread stack size
        _thread.stack_size(size)
        # Create thread
        thread_id = _thread.start_new_thread(function_task, argument)
        return thread_id


class AudioStreamManager(object):
    """
    Audio stream file format
    READ_AUDIO_STREAM_SIZE: socket read size
    """
    WAV_PCM = 2
    MP3 = 3
    AMR_NB = 4
    READ_AUDIO_STREAM_SIZE = 2*1024


class RequestServerManager(object):
    """
    socket requests audio stream data
    """
    def __init__(self):
        self.file_size = 0
        self.audio_play_id = None
        self.audio_obj = AudioManager()
        # Register an executable event function
        sys_bus.subscribe("play_music", self.play_music)
        sys_bus.subscribe("stop_music", self.stop_music)

    def get_audio_file_url(self, json_data):
        # Request data and shove it into the queue
        data = json_data.get("data")
        file_url = data.get("file_path") # url of audio file
        self.file_size = data.get("file_size") # file size
        print("Play music name: ", data.get("file_name"))
        # request get
        response = request.get(file_url)
        while True:
            # read audio msg
            audio_bytes_msg = response.raw.read(AudioStreamManager.READ_AUDIO_STREAM_SIZE)
            if not audio_bytes_msg:
                break
            # play msg
            self.audio_obj.audio_obj.playStream(AudioStreamManager.MP3, audio_bytes_msg)
            # delay 10 ms
            utime.sleep_ms(20)

    def play_music(self, topic, data):
        # create task
        self.audio_play_id = CreateThreadTask.create_thread(self.get_audio_file_url, (data,), size=8*1024)

    def stop_music(self, topic, data):
        if self.audio_play_id is not None:
            try:
                _thread.stop_thread(self.audio_play_id)
                self.audio_play_id = None
            except:
                print("audio_play_id error")
                self.audio_play_id = None



class AudioManager(object):

    def __init__(self):
        # init Audio
        self.audio_obj = audio.Audio(0)
        # set PA
        # self.audio_obj.set_pa(Pin.GPIO10)
        # set audio volume
        self.audio_obj.setVolume(11)
        # Register an executable event function
        self.music_bytes_msg = b''
        sys_bus.subscribe("stop_audio_play", self.stop_audio_play)

    def stop_audio_play(self, topic, data):
        # Stop playing
        try:
            # Stop playing
            self.audio_obj.stopPlayStream()
        except:
            pass


"""
Here is the Test code
"""

# Aliyun Connection parameter
client_id = "quectel_pawn"
productKey = "a1A5W32fexl"
deviceName = "QuecPawn_Music_Dev"
deviceSecret = "d4adf1a28619245017203276484be416"

# create aliyun object
ali_obj = ALiYunManage()
ali_obj.parameter_initialization(productKey, None, deviceName, deviceSecret, client_id)
# connect aliyun
ali_obj.aliyun_connect()
ali_obj.subscribe("/a1A5W32fexl/QuecPawn_Music_Dev/user/wechat_sub")
ali_obj.loop_forever()

# create request object
request_manger_obj = RequestServerManager()

print("Start ----------------")