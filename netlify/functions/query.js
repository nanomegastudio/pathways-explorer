// netlify/functions/query.js

import neo4j from "neo4j-driver";

export async function handler(event, context) {
  try {
    const { cypher, params } = JSON.parse(event.body);

    const driver = neo4j.driver(
      process.env.NEO4J_URI,
      neo4j.auth.basic(
        process.env.NEO4J_USER,
        process.env.NEO4J_PASSWORD
      )
    );

    const session = driver.session();
    const result = await session.run(cypher, params || {});

    const rows = result.records.map(record => ({
      row: [
        record.get(0),   // first return value
        record.get(1),   // second return value
        record.get(2)    // third return value
      ]
    }));

    await session.close();
    await driver.close();

    return {
      statusCode: 200,
      body: JSON.stringify(rows)
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}
