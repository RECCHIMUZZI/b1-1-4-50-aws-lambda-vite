import json
import os
import re
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

TABLE_NAME = os.environ["TABLE_NAME"]

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)

# CORS is handled by the Lambda Function URL configuration (see Terraform),
# not here, to avoid emitting duplicate Access-Control-Allow-* headers.
RESPONSE_HEADERS = {"Content-Type": "application/json"}

ID_PATTERN = re.compile(r"^[0-9a-fA-F-]{36}$")


def _response(status_code, body=None):
    return {
        "statusCode": status_code,
        "headers": RESPONSE_HEADERS,
        "body": json.dumps(body) if body is not None else "",
    }


def _now():
    return datetime.now(timezone.utc).isoformat()


def _extract_id(path):
    parts = [p for p in path.split("/") if p]
    if len(parts) == 2 and parts[0] == "tasks":
        return parts[1]
    return None


def list_tasks():
    items = table.scan().get("Items", [])
    items.sort(key=lambda t: t.get("createdAt", ""))
    return _response(200, items)


def get_task(task_id):
    result = table.get_item(Key={"id": task_id})
    item = result.get("Item")
    if not item:
        return _response(404, {"message": "Task not found"})
    return _response(200, item)


def create_task(body):
    try:
        data = json.loads(body or "{}")
    except json.JSONDecodeError:
        return _response(400, {"message": "Invalid JSON body"})

    title = data.get("title")
    if not isinstance(title, str) or not title.strip():
        return _response(400, {"message": "title is required"})

    now = _now()
    item = {
        "id": str(uuid.uuid4()),
        "title": title.strip(),
        "completed": False,
        "createdAt": now,
        "updatedAt": now,
    }
    table.put_item(Item=item)
    return _response(201, item)


def update_task(task_id, body):
    try:
        data = json.loads(body or "{}")
    except json.JSONDecodeError:
        return _response(400, {"message": "Invalid JSON body"})

    existing = table.get_item(Key={"id": task_id}).get("Item")
    if not existing:
        return _response(404, {"message": "Task not found"})

    if "title" in data:
        if not isinstance(data["title"], str) or not data["title"].strip():
            return _response(400, {"message": "title must be a non-empty string"})
        existing["title"] = data["title"].strip()

    if "completed" in data:
        if not isinstance(data["completed"], bool):
            return _response(400, {"message": "completed must be a boolean"})
        existing["completed"] = data["completed"]

    existing["updatedAt"] = _now()
    table.put_item(Item=existing)
    return _response(200, existing)


def delete_task(task_id):
    existing = table.get_item(Key={"id": task_id}).get("Item")
    if not existing:
        return _response(404, {"message": "Task not found"})
    table.delete_item(Key={"id": task_id})
    return _response(200, {"message": "Task deleted"})


def handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", event.get("httpMethod"))
    path = event.get("rawPath", event.get("path", "/"))

    if method == "OPTIONS":
        return _response(200)

    try:
        task_id = _extract_id(path)

        if path.rstrip("/") == "/tasks" or path.rstrip("/") == "":
            if method == "GET":
                return list_tasks()
            if method == "POST":
                return create_task(event.get("body"))

        elif task_id:
            if not ID_PATTERN.match(task_id):
                return _response(400, {"message": "Invalid task id"})
            if method == "GET":
                return get_task(task_id)
            if method == "PUT":
                return update_task(task_id, event.get("body"))
            if method == "DELETE":
                return delete_task(task_id)

        return _response(404, {"message": "Not found"})

    except ClientError as exc:
        return _response(500, {"message": str(exc)})
