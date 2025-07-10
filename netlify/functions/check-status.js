// This function will check the status of a job by querying the Azure Table Storage.
const { TableClient } = require("@azure/data-tables");

exports.handler = async function(event, context) {
  const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const TABLE_NAME = "analysisjobs";

  if (!AZURE_STORAGE_CONNECTION_STRING) {
    return { statusCode: 500, body: JSON.stringify({ message: "Azure storage connection is not configured." })};
  }

  const { id } = event.queryStringParameters;
  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ message: "Job ID is required." })};
  }

  try {
    const tableClient = TableClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING, TABLE_NAME);
    const entity = await tableClient.getEntity("jobs", id);

    let responseBody = { jobId: id, status: entity.status };
    
    if (entity.status === 'processing') {
      responseBody.progress = entity.progress;
    } else if (entity.status === 'complete') {
      responseBody.result = JSON.parse(entity.result);
    } else if (entity.status === 'failed') {
      responseBody.error = JSON.parse(entity.result).error;
    }

    return { statusCode: 200, body: JSON.stringify(responseBody) };

  } catch (error) {
    if (error.statusCode === 404) {
      return { statusCode: 200, body: JSON.stringify({ jobId: id, status: 'pending' })};
    }
    return { statusCode: 500, body: JSON.stringify({ message: "Failed to check job status.", details: error.message })};
  }
};
