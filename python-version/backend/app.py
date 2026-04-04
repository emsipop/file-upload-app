import os
import boto3
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from botocore.exceptions import ClientError
from botocore.config import Config

load_dotenv()

app = Flask(__name__)
CORS(app)

AWS_REGION = os.getenv("AWS_REGION")
S3_BUCKET = os.getenv("S3_BUCKET_NAME")
ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "txt", "csv", "docx"}
MAX_FILE_SIZE_MB = 10

s3 = boto3.client(
    "s3",
    region_name=AWS_REGION,
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
)

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": f"File type not allowed. Permitted: {ALLOWED_EXTENSIONS}"}), 400
    file.seek(0, 2)
    size_mb = file.tell() / (1024 * 1024)
    file.seek(0)
    if size_mb > MAX_FILE_SIZE_MB:
        return jsonify({"error": f"File too large. Max size: {MAX_FILE_SIZE_MB}MB"}), 400
    try:
        s3_key = f"uploads/{file.filename}"
        s3.upload_fileobj(file, S3_BUCKET, s3_key)
        return jsonify({"message": "File uploaded successfully", "key": s3_key}), 200
    except ClientError as e:
        return jsonify({"error": str(e)}), 500


@app.route("/files", methods=["GET"])
def list_files():
    try:
        response = s3.list_objects_v2(Bucket=S3_BUCKET, Prefix="uploads/")
        files = []
        for obj in response.get("Contents", []):
            files.append({
                "key": obj["Key"],
                "name": obj["Key"].replace("uploads/", ""),
                "size_kb": round(obj["Size"] / 1024, 2),
                "uploaded_at": obj["LastModified"].strftime("%Y-%m-%d %H:%M:%S"),
            })
        return jsonify({"files": files}), 200
    except ClientError as e:
        return jsonify({"error": str(e)}), 500


@app.route("/files/<path:file_key>/download", methods=["GET"])
def download_file(file_key):
    try:
        s3_client = boto3.client(
            "s3",
            region_name=AWS_REGION,
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            config=Config(
                signature_version='s3v4',
                s3={'addressing_style': 'virtual'}
            )
        )
        url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": S3_BUCKET, "Key": f"uploads/{file_key}"},
            ExpiresIn=300,
        )
        return jsonify({"url": url}), 200
    except ClientError as e:
        return jsonify({"error": str(e)}), 500


@app.route("/files/<path:file_key>", methods=["DELETE"])
def delete_file(file_key):
    try:
        s3.delete_object(Bucket=S3_BUCKET, Key=f"uploads/{file_key}")
        return jsonify({"message": f"{file_key} deleted successfully"}), 200
    except ClientError as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)