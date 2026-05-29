FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
WORKDIR /app

# Install system dependencies commonly required by imaging/ML libraries
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential \
       gcc \
       git \
       libjpeg-dev \
       zlib1g-dev \
       libpoppler-cpp-dev \
       poppler-utils \
       tesseract-ocr \
       libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt ./
RUN pip install --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt

# Copy app source
COPY . .

# Make a persistent storage dir for uploads
RUN mkdir -p storage/uploads tmp

# Default port; App Platform will override via $PORT
ENV PORT=8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
