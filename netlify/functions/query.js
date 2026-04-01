// netlify/functions/query.js

import neo4j from "neo4j-driver";

export async function handler(event, context) {
  console.log("FUNCTION INVOKED");
  console.log("EVENT BODY:", event.body);

  try {
    const { cypher, params } = JSON.parse(event.body);
    console.log("CYPHER:", cypher);
    console.log("PARAMS:", params);

    const driver = neo4j.driver(
      process.env.NEO4J_URI,
      neo4j.auth.basic(
        process.env.NEO4J_USER,
        process.env.NEO4J_PASSWORD
      )
    );

    const session = driver.session();
    const result = await session.run(cypher, params || {});
    console.log("RAW RESULT:", result);

    const rows = result.records.map(record => ({
      row: [
        record.get(0),
        record.get(1),
        record.get(2)
      ]
    }));

    console.log("FORMATTED ROWS:", rows);

    await session.close();
    await driver.close();

    return {
      statusCode: 200,
      body: JSON.stringify(rows)
    };

  } catch (err) {
    console.error("FUNCTION ERROR:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}
