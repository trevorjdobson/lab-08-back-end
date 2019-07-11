require('dotenv').config();

const pg = require('pg');

const client = new pg.Client(process.env.DATABASE_URL);

client.connect();
client.on('error', error=> {
  console.error(error);
})

function buildDb(){
  client.query(`
    DROP TABLE IF EXISTS weathers;
DROP TABLE IF EXISTS locations;
DROP TABLE IF EXISTS events;


CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  search_query VARCHAR(255),
  formatted_query VARCHAR(255),
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10,7)
);

CREATE TABLE weathers ( 
    id SERIAL PRIMARY KEY, 
    formatted_query VARCHAR(255),
    forecast VARCHAR(255), 
    time VARCHAR(255)
    -- location_id INTEGER NOT NULL,
    -- FOREIGN KEY (location_id) REFERENCES locations (id)
  );

CREATE TABLE events ( 
    id SERIAL PRIMARY KEY, 
    formatted_query VARCHAR(255),
    event_date VARCHAR(255),
    name VARCHAR(255),
    link TEXT,
    summary TEXT
);

    `)
  console.log('buid complete');
}
buildDb();
