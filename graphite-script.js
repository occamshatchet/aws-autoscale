var http = require('http');
var config = {
    instancesUrl : 'http://stats/render?format=json&target=sensu.aws.autoscale.lmm-prod.instance_count&from=-1min',
    messagesUrl : 'http://stats/render?format=json&target=sensu.prod.rabbitmq.nva-a-rabbitmq-p01.queues.SwaptionValuationQueueRequestQueue.messages&from=-5min',
    threshold : 20,
    baseline_instances : 2
};


function getInstances(callback) {
    var options = {
        host: 'stats',
        port: 80,
        path: config.instancesUrl,
        method: 'GET'
    };

    var req = http.request(options, function(res) {
        var data = '';
        
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
            data += chunk;
        });

        res.on('end', function() {
            if (res.statusCode === 200) {
                var jsonData = JSON.parse(data);
                var instances = jsonData[0].datapoints[0][0];

                callback(null, instances);
            } else {
                callback("Server returned " + res.statusCode + "\n" + instancesUrl, null);
            }
        });
    });

    req.on('error', function(e) {
        callback(e, null);
    });

    req.end();
}

function getAvgMessageLoad(callback) {
    var options = {
        host: 'stats',
        port: 80,
        path: config.messagesUrl,
        method: 'GET'
    };

    var req = http.request(options, function(res) {
        var data = '';
        
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
            data += chunk;
        });

        res.on('end', function() {
            if (res.statusCode === 200) {
                var jsonData = JSON.parse(data);
                var points = jsonData[0].datapoints;
                var sumPoints = 0;
                var numPoints = points.length;
                var count = 0;

                while(count < numPoints) {
                    sumPoints += points[count][0];
                    count++;
                }

                var avg = sumPoints/numPoints;

                callback(null, avg);
            } else {
                callback("Server returned " + res.statusCode + "\n" + messagesUrl, null);
            }
        });
    });

    req.on('error', function(e) {
        callback(e, null);
    });

    req.end();    
}

function getScaleDirection() {
    getInstances(function(err, instances) {
        if (err) {
            console.log({ code: -1, message: err });
            process.exit(1);
        }

        getAvgMessageLoad(function(err, average) {
            if (err) {
                console.log({ code: -1, message: err });
                process.exit(1);
            }

            // 100 == scale down
            // 200 == neutral
            // 300 == scale up
            var scale_dir = 200;
            var scale_msg = "NEUTRAL";

            if (average > config.threshold) {
                if (instances <= config.baseline_instances) {
                    scale_dir = 300;
                    scale_msg = "UP";
                }
            } else {
                if (instances > config.baseline_instances) {
                    scale_dir = 100;
                    scale_msg = "DOWN";
                }
            }

            console.log({ 
                exit_code : scale_dir + '[' + scale_msg + ']',
                averageMsgLoad : average,
                threshold: config.threshold,
                runningInstances : instances,
                baseline_instances : config.baseline_instances
            });
            process.exit(scale_dir);
        });
    });
}


getScaleDirection();