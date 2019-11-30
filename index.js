'use strict';

const https = require('https');
const Request = require('request');
const VisualRecognitionV3 = require('watson-developer-cloud/visual-recognition/v3');
var ChannelAccessToken = process.env['CHANNEL_ACCESS_TOKEN'];
var id;

exports.handler = (event, context, callback) => {
    console.log('EVENT:', event);
    const messageData = event.events[0];
    id = messageData.source.userId;
    if(messageData.source.groupId != null && messageData.source.groupId.length > 0){ //グループからのメッセージ
        id = messageData.source.groupId;
    }

    console.log('Message type:', messageData.message.type);
    if (messageData.message.type === "image") {
        console.log('Message id:', messageData.message.id);
        const options = {
            url: `https://api.line.me/v2/bot/message/${messageData.message.id}/content`,
            method: 'get',
            headers: {
                'Authorization': 'Bearer ' + ChannelAccessToken,
            },
            encoding: null
        };

        Request(options, function(error, response, body) {
            if (!error && response.statusCode == 200) {
                //保存
                console.log("call Watson");
                callWatson(body);
            } else {
                // @todo handle error
            }
        });
    }
    sendMessage("鑑定中！");

    callback(null, 'Success!');
};

var sendMessage = function(message) {
    console.log("sendMessage message:" + message);
    var postData = JSON.stringify(
    {
        "messages": [{
            "type": "text",
            "text": message
        }],
        "to": id
    });

    //リクエストヘッダ
    var options = {
        hostname: 'api.line.me',
        path: '/v2/bot/message/push',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': Buffer.byteLength(postData),
            'Authorization': 'Bearer ' + ChannelAccessToken
            },
        method: 'POST',
    };
    console.log(JSON.stringify(options));
    //APIリクエスト
    var req = https.request(options,  function(res){
        res.setEncoding('utf8');
        res.on('data', function (body) {
            console.log(body);
        });
    }).on('error', function(e) {
        console.log(e);
    });

    req.on('error', function(e) {
        var message = "通知に失敗しました. LINEから次のエラーが返りました: " + e.message;
        console.error(message);
    });

    req.write(postData);
    req.on('data', function (body) {
            console.log(body);
     });
    req.end();
    console.log("TEST:" + postData);
};

var callWatson = async function(images_file) {
    var toString = Object.prototype.toString;
    function typeOf(obj) {
      return toString.call(obj).slice(8, -1).toLowerCase();
    }
    console.log("typeof imagesfile:" + typeOf(images_file));

    var visualRecognition = new VisualRecognitionV3({
    	version: process.env['WATSON_API_VERSION'],
    	iam_apikey: process.env['WATSON_API_KEY']
    });
    var classifier_ids = [process.env['WATSON_CLASSIFIER_ID']];
    var threshold = 0;
    
    var params = {
    	images_file: images_file,
    	classifier_ids: classifier_ids,
    	threshold: threshold
    };
    console.log("visualRecognition");

    startKantei(visualRecognition, params);
};

async function startKantei(visualRecognition, params) {
    var response = await myPromise(3000, visualRecognition, params);
    if (response == "ok") {
        console.log("response ok:" + response);
    } else {
        console.log("response ng:" + response);
        sendMessage("鑑定に時間がかかっています！\nしばらく待つか、もう一度写真を貼ってください。");
    }
}

async function myPromise(ms, visualRecognition, params) {
  var timeout = (ms) => new Promise(function (resolve) {
    setTimeout(function () {
      // タイムアウト
      resolve("timeout");
    }, ms);
  });

  return Promise.race([
    timeout(ms),
    callVisualRecognition(visualRecognition, params)
  ]);
}

async function callVisualRecognition(visualRecognition, params) {
    return new Promise((resolve) => 
        visualRecognition.classify(params, function(err, response) {
            console.log("in visualRecognition");
        	if (err) { 
        		console.log(err);
        		return;
        	} else {
        		console.log(JSON.stringify(response, null, 2));
        	}
        	var responseText = "鑑定結果";
        	var resultArray = new Array(7);
        	response.images.forEach((image) => {
                image.classifiers.forEach((classifier) => {
                    classifier.classes.forEach((result) => {
                       switch (result.class) {
                           case 'habanero':
                                console.log("ハバネロ顔度　:" + result.score);
                               resultArray[3] = "\nハバネロ顔度　:" + createStarString(result.score);
                               break;
                           case 'shio':
                                console.log("塩顔度:" + result.score);
                               resultArray[1] =  "\n塩顔度　　　　:" + createStarString(result.score);
                               break;
                           case 'source':
                                console.log("ソース度:" + result.score);
                               resultArray[2] = "\nソース顔度　　:" + createStarString(result.score);
                               break;
                           case 'syouyu':
                                console.log("しょうゆ顔度:" + result.score);
                               resultArray[0] = "\nしょうゆ顔度　:" + createStarString(result.score);
                               break;
                           case 'ketchup':
                                console.log("ケチャップ顔度:" + result.score);
                               resultArray[4] = "\nケチャップ顔度:" + createStarString(result.score);
                               break;
                           case 'mayo':
                                console.log("マヨネーズ顔度:" + result.score);
                               resultArray[5] = "\nマヨネーズ顔度:" + createStarString(result.score);
                               break;
                           case 'sato':
                                console.log("さとう顔度:" + result.score);
                               resultArray[6] = "\nさとう顔度　　:" + createStarString(result.score);
                               break;
                           default:
                               // code
                       } 
                    });
                });
            });
            for (let i = 0; i < 7; i++) {
                responseText = responseText + resultArray[i];
            }
            sendMessage(responseText);
            resolve("ok");
        })
    );
}

var createStarString = function(score) {
    var loopMax = Math.round(score * 5);
    console.log("score:" + score);
    console.log("loopMax:" + loopMax);
    var result = "";
    for (let i = 0 ; i <= loopMax; i++) {
        result += "☆";
    }
    return result;
};