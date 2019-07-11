'Use strict'

//Dependencies
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');


//Global vars
const PORT = process.env.PORT || 3001;

const client = new pg.Client(process.env.DATABASE_URL);

client.connect();
client.on('error', error=> {
  console.error(error);
})

//Apps
const app = express();
app.use(cors());


//Routes
app.get('/location', searchLatLong);

app.get('/weather', searchWeather);

app.get('/events', searchEvents);

app.use('*', (req, res) => {
  res.send('You got in the wrong place')
})


/*--Functions--*/

function FormattedLocation(query, data) {
  this.search_query = query;
  this.formatted_query = data.results[0].formatted_address;
  this.latitude = data.results[0].geometry.location.lat;
  this.longitude = data.results[0].geometry.location.lng
}

function FormattedDailyWeather(data) {
  this.forecast = data.summary;
  this.time = new Date(data.time * 1000).toDateString();
}

function FormattedEvent(data) {
  this.name = data.name.text;
  this.link = data.url;
  this.event_date = new Date(data.start.local).toDateString();
  this.summary = data.description.text;
}

function searchLatLong(request, response) {
  let locationName = request.query.data || 'seattle';
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${locationName}&key=${process.env.GEOCODE_API_KEY}`

  client.query(`SELECT * FROM locations WHERE search_query=$1`, [locationName])
    .then(sqlResult => {

      if(sqlResult.rowCount === 0){
        superagent.get(url)
          .then(result => {
            let location = new FormattedLocation(locationName, result.body);

            client.query(
              `INSERT INTO locations (
            search_query,
            formatted_query,
            latitude,
            longitude
          ) VALUES ($1, $2, $3, $4)`,
              [location.search_query, location.formatted_query, location.latitude, location.longitude]
            )
            response.send(location);
          }).catch(e => {
            console.error(e);
            response.status(500).send('Status 500')
          })
      } else {
        response.send(sqlResult.rows[0]);
      }
    });
}
async function getData(table,formattedAddress,url){
  let data = await client.query(`SELECT * FROM ${table} WHERE formatted_query=$1`, [formattedAddress])

  let output = {};
      if(data.rowCount === 0){
        output.isInDatabase = false;
        let apiResult = await superagent.get(url)
        let forecastArr = apiResult.body
        output.data = forecastArr;
       }else{ 
        output.isInDatabase = true;
        output.data = data.rows;
      }
      return output;
}

async function searchWeather(request, response) {
  // console.log(request.query.data.latitude)
  let lat = request.query.data.latitude;
  let long = request.query.data.longitude;
  const formattedQuery = request.query.data.formatted_query;
  let weatherLocation = `${lat},${long}` || '37.8267,-122.4233';
  const APIurl = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${weatherLocation}`;
  let data = await getData('weathers',request.query.data.formatted_address,APIurl)
  if(data.isInDatabase === false){
    let forecastArr = data.data.daily.data.map(el => {
      return new FormattedDailyWeather(el);
    })
    forecastArr.forEach(el=>{
      client.query(
        `INSERT INTO weathers ( 
      formatted_query,
      forecast, 
      time
    ) VALUES ($1, $2, $3)`,
        [formattedQuery, el.forecast, el.time]
      )
    })
    response.send(forecastArr);
  } else {
    response.send(data.rows);
  }
}

async function searchEvents(request, response) {
  let lat = request.query.data.latitude;
  let long = request.query.data.longitude;
  const formattedQuery = request.query.data.formatted_query;
  const url = `https://www.eventbriteapi.com/v3/events/search/?token=${process.env.EVENTBRITE_API_KEY}&location.latitude=${lat}&location.longitude=${long}`
  
  let data = await getData('events',request.query.data.formatted_address, url)
  if(data.isInDatabase === false){
    let eventsArr = data.data.events.map(el => {
      return new FormattedEvent(el);
    })
    eventsArr.forEach(el=>{
      client.query(
        `INSERT INTO events ( 
      formatted_query,
      event_date, 
      link,
      summary,
      name
    ) VALUES ($1, $2, $3, $4, $5)`,
        [formattedQuery, el.event_date, el.link, el.summary, el.name]
      )
    })
    response.send(eventsArr);
  } else {
    response.send(data.rows);
  }
  
  //   }).catch(e => {
  //     console.log(e);
  //     response.status(500).send('Status 500');
  //   })
}

//Starting Server
app.listen(PORT, () => {
  console.log('listing on port', PORT);
})
