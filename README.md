# NASA-Space-Apps

To run the project, follow these steps:
1. Clone the repository:
   ```bash
   git clone https://github.com/Noe-Sanchez/NASA-Space-Apps.git
   cd NASA-Space-Apps
    ```

2. Run fastapi, for the backend: 
   ```bash
   # Navigate to the root directory of the project (NASA-Space-Apps)
   pip install "fastapi[all]" pydantic-settings geopandas google-generativeai
   uvicorn app.api.main:app --reload
   ```

3. Run the frontend, in another terminal:
   ```bash
   cd app/frontend
   npm install
   npm run dev
   ```

4. Open your browser and go to `http://localhost:4321` to see the application in action.

https://youtu.be/XqZsoesa55w
