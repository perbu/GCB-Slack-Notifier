const {IncomingWebhook} = require('@slack/webhook');


/*
  Create a config.js file with the following content:
  module.exports = {
  hook: 'https://hooks.slack.com/services/....', // Enter Your Slack Webhook URL here
  baseUrl: 'https://github.com/.../' // The base url of your organization/bitbucket/github
}

 */
const config = require('./config.js');
const webhook = new IncomingWebhook(config.hook);

// subscribe is the main function called by Cloud Functions.
module.exports.subscribe = (event, context, callback) => {
  const build = eventToBuild(event.data);

  // Skip if the current status is not in the status list.
  // Add additional statues to list if you'd like:
  // QUEUED, WORKING, SUCCESS, FAILURE,
  // INTERNAL_ERROR, TIMEOUT, CANCELLED
  const status = [
    'SUCCESS',
    'FAILURE',
    'INTERNAL_ERROR',
    'TIMEOUT',
  ];

  if (status.indexOf(build.status) === -1) {
    console.log(`Build ${build.id} status is ${build.status}, skipping notification`);
    if (typeof callback === 'function') {
      return callback();
    }
    console.log('callback is not a function');
    return;
  }

  // Send message to Slack.
  const message = createSlackMessage(build);
  webhook.send(message, callback);
};

// eventToBuild transforms pubsub event message to a build object.
const eventToBuild = (data) => {
  return JSON.parse(Buffer.from(data, 'base64').toString());
};

// createSlackMessage create a message from a build object.
const createSlackMessage = (build) => {
  // console.log('build:', build);
  let buildId = build.id || '[no id]';
  let buildCommit = build.substitutions.COMMIT_SHA || '[no SHA]';
  let branch = build.substitutions.BRANCH_NAME || '[no branch]';
  let repoName = build.substitutions.REPO_NAME || '[no repo name]';
  const start = new Date(build.startTime);
  const finish = new Date(build.finishTime);
  let message = {
    text: `Build - \`${buildId}\` of `+repoName+` on branch \`${branch}\``,
    mrkdwn: true,
    attachments: [
      {
        title: 'View Build Logs',
        title_link: build.logUrl,
        fields: [
          {
            title: 'Status: ' + build.status,
          },
          {
            title: 'Duration: ' +  (finish.getTime()-start.getTime())/1000 + ' seconds',
          },
          {
            title: 'Images',
            value: build.images || '[no images]',
          },
          {
            title: `Commit - ${buildCommit}`,
            title_link: config.baseUrl + `${repoName}/commits/${buildCommit}`, // Insert your Organization/Bitbucket/Github Url
          },
        ],
      },
    ],
  };
  return message;
};
