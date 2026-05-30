const express = require('express');
const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Route to handle GET requests to the root URL
app.get('/', (req, res) => {
    res.send('Hello, World!');
});

// Route to handle GET requests to /about
app.get('/about', (req, res) => {
    res.send('This is the about page.');
});

// Route to handle POST requests to /data
app.post('/data', (req, res) => {
    const data = req.body;
    res.send(`You sent: ${JSON.stringify(data)}`);
});

// Route to handle PUT requests to /update
app.put('/update', (req, res) => {
    const data = req.body;
    res.send(`You updated: ${JSON.stringify(data)}`);
});

// Route to handle DELETE requests to /delete
app.delete('/delete', (req, res) => {
    res.send('Delete request received.');
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});