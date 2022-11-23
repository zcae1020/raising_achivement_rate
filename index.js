const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');
const express = require('express')
const cors = require('cors')

const app = express()
const port = process.env.PORT || 5000

app.use(cors());

app.get('/', (req, res) => {
  res.send('hello');
})

app.get('/taskLists', async (req, res) => {
  authorize()
  .then(async (auth)=>{
    let taskList = await listTaskLists(auth);
    res.json(taskList);
  })
  .catch(console.error);
})

app.get('/rate', (req, res) => {
  authorize()
  .then(async (auth)=>{
    let rate = await DefaultRateTaskList(auth);
    console.log("rate" +rate);
    res.json({rate: rate});
  })
  .catch(console.error);
})

app.get('/rate/:id', (req, res) => {
  authorize()
  .then(async (auth)=>{
    console.log(req.params["id"]);
    let rate = await RateTaskList(auth, req.params["id"]);
    console.log("rate" +rate);
    res.json({rate: rate});
  })
  .catch(console.error);
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/tasks.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Lists the user's first 10 task lists.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listTaskLists(auth) {
  const service = google.tasks({version: 'v1', auth});
  const res = await service.tasklists.list({
    maxResults: 10,
  });
  const taskLists = res.data.items;
  return taskLists;
}

async function DefaultRateTaskList(auth) {
  const service = google.tasks({version: 'v1', auth});
  const res = await service.tasklists.list({
    maxResults: 10,
  });
  const taskLists = res.data.items;

  return getRate(taskLists[0], service);
}

async function RateTaskList(auth, id) {
  const service = google.tasks({version: 'v1', auth});
  const res = await service.tasklists.get({
    tasklist: id,
  });
  const taskList = res.data;

  return getRate(taskList, service);
}

async function getRate(taskList, service) {
  console.log(taskList);
  let hiddenTrue = await service.tasks.list({
    maxResults: 100,
    tasklist: taskList.id,
    showHidden: true
  })

  let hiddenFalse = await service.tasks.list({
    maxResults: 100,
    tasklist: taskList.id,
  })

  let item = hiddenTrue.data.items;
  let uncompleteItem = hiddenFalse.data.items;

  let total = item.length;
  let complete = total - uncompleteItem.length;

  console.log("complete" + complete)
  console.log("total" + total);

  return parseInt((complete / total) * 100);
}

