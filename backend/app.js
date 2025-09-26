//express is a library that helps us create a server.
const express = require('express');
//cors is a library that helps us enable cross-origin resource sharing i.e allow requests from other servers. 
const cors = require('cors');
//body-parser is a library that helps us parse the body of the request in a Json format.
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
//app is an instance of express.
var app = express();
//We are using the cors and bodyParser libraries.
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
//We are connecting to the mongodb database.
const MONGO_URL = process.env.MONGO_URL || 'mongodb://host.docker.internal:27017/gardens';
mongoose.connect(MONGO_URL);
//we create a route for the identify endpoint.
const signup = require('./routes/signup');
const token = require('./routes/token');
const {isLoggedIn}  = require('./controllers/token');
const gardenRoutes = require('./routes/gardenRoutes');
const helperRoutes = require("./routes/helper");
//we use the identify route as /identify.
app.use('/api/signup', signup);
app.use('/api/token', token);
app.use('/api',isLoggedIn ,gardenRoutes);
//add iSLoggedIn method here when done
app.use("/api/helper", helperRoutes);
//for the frontend validation
app.get('/api/session', isLoggedIn, (req, res) => {
  res.json({ ok: true, user_id: req.userId });
});

const path = require("path");
app.use("/static/photos",
  express.static(path.join(process.cwd(), "uploads/photos"))
);
const PORT = parseInt(process.env.API_PORT || '12345', 10);
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

