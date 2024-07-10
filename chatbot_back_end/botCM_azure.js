require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 3000;

app.use(express.static(__dirname + '/public'));

//api key 
const azureApiKey = 'your API here'; //

//read responses
let responses;

try {
    responses = JSON.parse(fs.readFileSync('responses.json', 'utf8'));
} catch (error) {
    console.error('Error reading responses:', error);
    process.exit(1); //exit if responses.json cannot be read
}

//soft fallback counter and previous intent tracker
const fallbackCounts = {};
const previousIntent = {};

//get intent from the message using Azure CLU
async function getIntent(message) {
    const url = 'your CLU resource url';
    const headers = {
        'Ocp-Apim-Subscription-Key': azureApiKey,
        'Content-Type': 'application/json'
    };
    const data = {
        "kind": "Conversation",
        "analysisInput": {
            "conversationItem": {
                "id": "1",
                "participantId": "1",
                "text": message
            }
        },
        "parameters": {
            "projectName": "deggbot_intent_recog", //
            "deploymentName": "degbot_model_1_dep", //
            "stringIndexType": "TextElement_V8"
        }
    };

    try {
        const response = await axios.post(url, data, { headers });
        const result = response.data.result;
        const topIntent = result.prediction.topIntent;
        const topIntentConfidenceScore = result.prediction.intents.find(intent => intent.category === topIntent).confidenceScore;

        //to be able to have soft fallbacks and hard fallbacks, we set a limit for the minimum confidence score 
        //if the minimum confidence score is not reached, intent will be set to null so that soft_fb and hard_fb can be invoked
        if (topIntentConfidenceScore >= 0.82) {
            return topIntent;
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error detecting intent with Azure CLU:', error);
        return null;
    }
}

io.on('connection', (socket) => {
    console.log('A user connected');

    //init fallback count and previous intent for the connected user
    fallbackCounts[socket.id] = 0;
    previousIntent[socket.id] = null;

    socket.on('message', async (message) => {
        const intent = await getIntent(message.toLowerCase());

        if (intent) {
            let response = responses[intent];
            socket.emit('response', { text: response });

            //reset the fallback count and update previous intent on a good response
            fallbackCounts[socket.id] = 0;
            previousIntent[socket.id] = intent;
        } else {
            fallbackCounts[socket.id]++;

            if (fallbackCounts[socket.id] >= 3) {
                let responseText;
                if (previousIntent[socket.id] && previousIntent[socket.id].includes('insurance')) {
                    responseText = "It seems like you have insurance-related questions. Could you please clarify your query or ask about something specific regarding health insurance?";
                } else if (previousIntent[socket.id] && previousIntent[socket.id].includes('bank_account')) {
                    responseText = "It seems like you have bank account-related questions. Could you please clarify your query or ask about something specific regarding bank accounts?";
                } else {
                    responseText = "I'm sorry, but I seem to be having trouble understanding you, I shall now clear the page, and start over.";
                    setTimeout(() => {
                        socket.emit('clear');
                    }, 4000); //emit event to clear chatbot page for hard fallback
                }
                socket.emit('response', { text: responseText });

                //reset the fallback count
                fallbackCounts[socket.id] = 0;
            } else {
                let responseText;
                if (previousIntent[socket.id] && previousIntent[socket.id].includes('insurance')) {
                    responseText = "I am sorry I cannot understand you, please rephrase your insurance-related query. Can you provide more details about the health insurance you are looking for?";
                } else if (previousIntent[socket.id] && previousIntent[socket.id].includes('bank_account')) {
                    responseText = "I am sorry I cannot understand you, please rephrase your bank account-related query. Can you provide more details about the bank account you are looking to open?";
                } else {
                    responseText = "I am sorry I cannot understand you, please rephrase your query, and please make your questions clear and precise!";
                }
                socket.emit('response', { text: responseText });
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
        //reset fallback and previous intent on disconnect
        delete fallbackCounts[socket.id];
        delete previousIntent[socket.id];
    });
});

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

//start server
server.listen(port, () => {
    console.log(`Chatbot is listening on port ${port}`);
});
