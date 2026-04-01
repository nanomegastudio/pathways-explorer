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

    await session.close();
    await driver.close();

    return {
      statusCode: 200,
      body: JSON.stringify(result.records.map(r => r.toObject()))
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}
