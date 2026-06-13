FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY src ./src
ENV PYTHONPATH=/app/src
ENV SWARAJYA_MCP_TRANSPORT=http
ENV SWARAJYA_MCP_HOST=0.0.0.0
# PORT is set by Railway / most container hosts. Fall back to 8000 locally.
ENV PORT=8000

EXPOSE 8000
CMD ["python", "-m", "swarajya_mcp.server"]
