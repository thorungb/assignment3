const express = require("express");
const fs = require("fs");
const amqp = require('amqplib');

if (!process.env.PORT) {
    throw new Error("Please specify the port number for the HTTP server with the environment variable PORT.");
}

if (!process.env.RABBIT) {
    throw new Error("Please specify the name of the RabbitMQ host using environment variable RABBIT");
}

const PORT = process.env.PORT;
const RABBIT = process.env.RABBIT;

//
// Application entry point.
//
async function main() {
	
    console.log(`Connecting to RabbitMQ server at ${RABBIT}.`);

    const messagingConnection = await amqp.connect(RABBIT); // Connects to the RabbitMQ server.
    
    console.log("Connected to RabbitMQ.");

    const messageChannel = await messagingConnection.createChannel(); // Creates a RabbitMQ messaging channel.

	await messageChannel.assertExchange("viewed", "fanout"); // Asserts that we have a "viewed" exchange.

    //
    // Broadcasts the "viewed" message to other microservices.
    //
	function broadcastViewedMessage(messageChannel, videoId) {
	    console.log(`Publishing message on "viewed" exchange.`);
	        
	    const msg = { videoPath: `viewed-${videoId}` }; // Format the video view message.
	    const jsonMsg = JSON.stringify(msg);
	    messageChannel.publish("viewed", "", Buffer.from(jsonMsg)); // Publishes message to the "viewed" exchange.
	}

    const app = express();

    app.get("/video", async (req, res) => { // Route for streaming video.

        // Get the video ID from the query string.
        const videoId = req.query.id; // Gets the video ID from the query string.
        let videoPath;

        if (videoId === '1') { // Determines the video path based on the video ID.
            videoPath = './videos/video1.mp4';
        } else if (videoId === '2') {
            videoPath = './videos/video2.mp4';
        } else {
            return res.status(404).send('Video not found');
        }

        const stats = await fs.promises.stat(videoPath);

        res.writeHead(200, {
            "Content-Length": stats.size,
            "Content-Type": "video/mp4",
        });
    
        fs.createReadStream(videoPath).pipe(res);

        broadcastViewedMessage(messageChannel, videoId); // Sends the "viewed" message to indicate this video has been watched.
    });

    app.listen(PORT, () => {
        console.log("Microservice online.");
    });
}

main()  // Starts the microservice.
    .catch(err => {
        console.error("Microservice failed to start.");
        console.error(err && err.stack || err);
    });