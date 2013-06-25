var http = require('http');

var target = process.argv[2]
    , from = process.argv[3]
    , threshold = parseInt(process.argv[4])
    , instances = parseInt(process.argv[5]);

var  baseline_instances = 2;
var url = '/render?format=json&target=' + target + '&from=' + from;
//var url = 'http://stats/render?format=json&target=sensu.prod.rabbitmq.nva-a-rabbitmq-p01.queues.SwaptionValuationQueueRequestQueue.messages&from=-5min';

var options = {
    host: 'stats',
    port: 80,
    path: url,
    method: 'GET'
};

var req = http.request(options, function(res) {
    var data = '';
    
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
        data += chunk;
    });

    res.on('end', function() {
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
        var scale_dir = "neutral";

        // just assuming on/off right now rather 
        // than graduated scale up/down
        if (avg > threshold) {
            if (instances <= baseline_instances) {
                scale_dir = "up";
            } else { 
                scale_dir = "neutral";
            }
        } else {
            if (instances > baseline_instances) {
                scale_dir = "down";
            } else {
                scale_dir = "neutral";
            }
        }

        console.log({
            target: target,
            current_instances: instances,
            baseline_instances: baseline_instances,
            threshold: threshold,
            average: avg,
            result: scale_dir
        });
    });
});

req.on('error', function(e) {
    console.log(e);
});

req.end();