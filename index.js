import express from 'express';
import cors from 'cors';
import ytdl from '@distube/ytdl-core';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/youtube', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: "Message cannot be empty." });
        }

        const playRegex = /^play (.+?)(?: by (.+))?$/;
        const match = message.trim().match(playRegex);
        if (!match) {
            return res.status(400).json({
                error: "Invalid command format. Use 'play <music name> by <artist name>'"
            });
        }

        const musicName = match[1].trim();
        const artistName = match[2] ? match[2].trim() : null;
        const searchQuery = artistName ? `${musicName} by ${artistName}` : musicName;

        // Use YouTube's search page with a browser-like User-Agent header
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
        const searchResponse = await fetch(searchUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            },
        });
        const html = await searchResponse.text();

        // Regex to extract the first videoId from the page
        const videoIdRegex = /"videoId":"(.*?)"/;
        const matchVideoId = html.match(videoIdRegex);
        if (!matchVideoId) {
            return res.status(404).json({ error: "No videos found." });
        }

        const videoId = matchVideoId[1];
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        // Get video info using ytdl-core
        const info = await ytdl.getInfo(videoUrl, {
            requestOptions: {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
                },
            },
        });
        
        const audioFormats = ytdl.filterFormats(info.formats, "audioonly");
        if (audioFormats.length === 0) {
            return res.status(404).json({ error: "No audio formats available." });
        }

        // Prefer an MP4 format if available; otherwise choose the highest bitrate
        const bestAudioFormat =
            audioFormats.find((format) => format.container === "mp4") ||
            audioFormats.reduce((prev, current) =>
                prev.audioBitrate > current.audioBitrate ? prev : current
            );
        
        const audioUrl = bestAudioFormat.url;
        const title = info.videoDetails.title;

        return res.status(200).json({ 
            response: { 
                name: title, 
                url: audioUrl 
            } 
        });
    } catch (error) {
        console.error("Error:", error);
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
        return res.status(500).json({ error: errorMessage });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});