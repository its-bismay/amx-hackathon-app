# Production Dockerfile for OPA (Open Policy Agent) Governance Sidecar
FROM openpolicyagent/opa:latest

# Copy governance policies into image
COPY secure-banking-fabric/policies /policies

EXPOSE 8181

# Serve OPA server loading rego policy rules
CMD ["run", "--server", "--addr=0.0.0.0:8181", "/policies"]
