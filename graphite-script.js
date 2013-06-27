var http = require('http');

var args = require('commander')
  .version('0.0.1')
  .option('-i, --instance_target [target]', 'Instance count target', 'sensu.aws.autoscale.lmm-prod.instance_count')
  .option('-q, --queue_target [target]', 'Message queue target', 'sensu.prod.rabbitmq.nva-a-rabbitmq-p01.queues.SwaptionValuationQueueRequestQueue.messages')
  .option('-a, --queue_messages_avg [number]', 'Average messages queued over time period', 5, parseInt)
  .option('-t, --time_period [time period]', 'Message queue time period to average','-5min')
  .option('-g, --graphite_hostname [hostname]', 'Graphite server hostname', 'stats')
  .option('-p, --graphite_port [port]', 'Graphite server port', 80, parseInt)
  .option('-b, --baseline_instances [port]', 'Baseline instances', 2, parseInt)
  .parse(process.argv);

var config = {
  instancesUrl : '/render?format=json&target=' + args.instance_target + '&from=-1min',
  messagesUrl : '/render?format=json&target=' + args.queue_target + '&from=' + args.time_period,
  threshold : args.queue_messages_avg,
  baseline_instances : args.baseline_instances
};

function getInstances(callback) {
  var options = {
    host: args.graphite_hostname,
    port: args.graphite_port,
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
    host: args.graphite_hostname,
    port: args.graphite_port,
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

      // -100 == scale downl
      // 0 == neutral
      // 100 == scale up
      var scale_dir = 0;
      var scale_msg = "NEUTRAL";

      if (average > config.threshold) {
        if (instances <= config.baseline_instances) {
          scale_dir = 100;
          scale_msg = "UP";
        }
      } else {
        if (instances > config.baseline_instances) {
          scale_dir = -100;
          scale_msg = "DOWN";
        }
      }

      console.log('[SCALE ' + scale_msg + '] AverageMsgLoad: ' + average + ', RunningInstances: ' + instances)
      process.exit(scale_dir);
    });
  });
}


getScaleDirection();