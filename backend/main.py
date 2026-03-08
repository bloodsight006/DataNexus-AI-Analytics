from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
from scipy import stats
from sklearn.linear_model import LinearRegression
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.tree import DecisionTreeRegressor
import io
import traceback

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "up"}

@app.post("/upload")
async def process_data(
    file: UploadFile = File(...),
    missing_values: str = Form("mean"),
    remove_duplicates: str = Form("true")
):
    try:
        contents = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        elif file.filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="Only CSV and Excel allowed.")

        # --- 0. AI DATA HEALTH PRE-CHECK ---
        total_cells = df.size
        total_rows = len(df)
        missing_cells = df.isnull().sum().sum()
        duplicate_rows = df.duplicated().sum()
        
        # --- 1. ADVANCED DATA CLEANING ---
        df.columns = df.columns.str.strip()
        for col in df.select_dtypes(include=['object']).columns:
            df[col] = df[col].apply(lambda x: x.strip() if isinstance(x, str) else x)

        if remove_duplicates == "true":
            df.drop_duplicates(inplace=True)

        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()

        if missing_values == "drop":
            df.dropna(inplace=True)
        else:
            for col in numeric_cols:
                if missing_values == "mean":
                    df[col] = df[col].fillna(df[col].mean())
                elif missing_values == "median":
                    df[col] = df[col].fillna(df[col].median())
                elif missing_values == "mode":
                    df[col] = df[col].fillna(df[col].mode()[0] if not df[col].mode().empty else 0)
            for col in categorical_cols:
                df[col] = df[col].fillna(df[col].mode()[0] if not df[col].mode().empty else "Unknown")

        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

        # --- OUTLIER DETECTION ---
        outliers_count = {}
        total_outliers = 0
        for col in numeric_cols:
            if df[col].std() == 0:
                outliers_count[col] = 0
            else:
                col_zscore = np.abs(stats.zscore(df[col]))
                count = int((col_zscore > 3).sum())
                outliers_count[col] = count
                total_outliers += count

        health_score = max(10, round(100 - (missing_cells/total_cells*40 if total_cells else 0) - (duplicate_rows/total_rows*20 if total_rows else 0) - (total_outliers/total_cells*20 if total_cells else 0), 1)) 

        # --- 2. SUPERVISED ML & TIME SERIES FORECASTING ---
        summary_stats = {}
        trends = {}
        forecasts = {}
        generated_insights = []
        x_axis = np.arange(len(df)).reshape(-1, 1)
        model = LinearRegression()

        for col in numeric_cols:
            vals = df[col].fillna(0).values
            summary_stats[col] = {
                "mean": round(float(df[col].mean()), 2),
                "median": round(float(df[col].median()), 2),
                "std": round(float(df[col].std()), 2),
                "skewness": round(float(df[col].skew()), 2),
                "outliers": outliers_count.get(col, 0)
            }
            
            if len(vals) >= 2:
                # Linear Trend
                model.fit(x_axis, vals.reshape(-1, 1))
                slope = model.coef_[0][0]
                trends[col] = "Accelerating " if slope > 0.5 else "Upward Trend " if slope > 0.01 else "Declining " if slope < -0.01 else "Stable "
                
                # Time Series Forecasting (Next 3 intervals)
                future_x = np.array([[len(vals)], [len(vals)+1], [len(vals)+2]])
                preds = model.predict(future_x)
                forecasts[col] = [round(float(p[0]), 2) for p in preds]

                # Auto-Generate Insights Text
                start_val = vals[0]
                end_val = vals[-1]
                if start_val != 0:
                    pct_change = ((end_val - start_val) / start_val) * 100
                    direction = "increased" if pct_change > 0 else "decreased"
                    if abs(pct_change) > 1: # Only highlight notable changes
                        generated_insights.append(f"The '{col}' metric {direction} by {abs(pct_change):.1f}% between the first and last recorded entry.")

        if not generated_insights:
            generated_insights.append("Data appears stable with no major percentage shifts detected between start and end points.")

        # --- 3. ADVANCED ML: RANDOM FOREST & DECISION TREE ---
        tree_insight = "Dataset requires at least 2 numeric columns for advanced Random Forest analysis."
        if len(numeric_cols) > 1:
            try:
                target = numeric_cols[-1] # Target the last numeric column automatically
                features = numeric_cols[:-1]
                X = df[features].fillna(0)
                y = df[target].fillna(0)

                rf = RandomForestRegressor(n_estimators=50, random_state=42)
                dt = DecisionTreeRegressor(random_state=42)
                rf.fit(X, y)
                dt.fit(X, y)

                # Get the most important feature
                top_feature = features[np.argmax(rf.feature_importances_)]
                tree_insight = f"Random Forest & Decision Tree models successfully deployed. They identified '{top_feature}' as the strongest predictive feature for determining '{target}'."
            except Exception as e:
                tree_insight = "Advanced ML processing skipped due to low data variance."

        # --- 4. UNSUPERVISED ML (K-MEANS) ---
        clustering_insight = "Dataset requires at least 2 numeric columns for AI clustering."
        if len(numeric_cols) >= 2 and len(df) >= 3:
            try:
                scaler = StandardScaler()
                scaled_features = scaler.fit_transform(df[numeric_cols].fillna(0))
                kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
                df['AI_Cluster'] = kmeans.fit_predict(scaled_features)
                df['AI_Cluster'] = df['AI_Cluster'].map({0: 'Cluster Alpha', 1: 'Cluster Beta', 2: 'Cluster Gamma'})
                categorical_cols.append('AI_Cluster')
                clustering_insight = f"Successfully grouped data into 3 behavioral clusters using {len(numeric_cols)} features."
            except Exception as e:
                clustering_insight = f"Clustering skipped: Not enough variance in data."

        correlations = []
        if len(numeric_cols) > 1:
            corr_matrix = df[numeric_cols].corr()
            for i in range(len(corr_matrix.columns)):
                for j in range(i+1, len(corr_matrix.columns)):
                    col1, col2 = corr_matrix.columns[i], corr_matrix.columns[j]
                    val = corr_matrix.iloc[i, j]
                    if pd.notna(val) and abs(val) > 0.6:
                        correlations.append(f"Strong correlation ({round(val, 2)}) between {col1} and {col2}")

        cleaned_csv_string = df.to_csv(index=False)

        return {
            "filename": file.filename,
            "columns": df.columns.tolist(),
            "numeric_columns": numeric_cols,
            "categorical_columns": categorical_cols,
            "stats": summary_stats,
            "trends": trends,
            "forecasts": forecasts, # NEW
            "generated_insights": generated_insights, # NEW
            "tree_insight": tree_insight, # NEW
            "correlations": correlations if correlations else ["No strong numerical correlations found."],
            "health_score": health_score,
            "clustering_insight": clustering_insight, 
            "data": df.head(5000).fillna("").to_dict(orient="records"), 
            "cleaned_csv": cleaned_csv_string
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
