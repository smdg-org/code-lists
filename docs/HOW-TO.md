# How-To Guides

## Accessing API

### Authentication

To use the SMDG API's you will need to authenticate, this is a simple step and immediately gives access to the API once complete.  SMDG maintain the data sets for the Liner Codes and Terminal codes, for both of these there is close co-operation with [BIC](https://www.bic-code.org/api/) who provide the infrastructure for the API, so to access the API you will need to sign up for a [free account here](https://portal.bic-code.org/sign-up) once registered you will be able to use your username/password with the BASIC auth method to use the API.

The API can be reached at https://api.smdg.org

Example Curl Request: 
```
curl --location --request POST 'https://api.smdg.org/v1/oauth/token' \
--header 'Authorization: Basic ZGF2aWRAY2....'
```

### Endpoints and Filtering

The API specification is available here: https://github.com/smdg-org/code-lists/tree/main/src/api/swagger

```bash
# GET all liner codes
curl --location 'https://api.smdg.org/v1/linercodes' \
--header 'Authorization: eyJraWQiOiJUVW9vRTdaVnVKNms4bjVDV....'

# GET specific Liner Code (i.e. ACS)
curl --location 'https://api.smdg.org/v1/linercodes?smdgLinerCode=ACS' \
--header 'Authorization: eyJraWQiOiJUVW9vRTdaVnVKNms4bjVDV....'
```
