"""Quick syntax + path check for the new ml-service wiring."""
import py_compile, pathlib, sys

files = [
    "app/services/predictor.py",
    "app/services/model_registry.py",
    "app/routers/prediction.py",
    "app/routers/health.py",
    "app/main.py",
    "models/transaction-classifier/predict.py",
]

ok = True
for f in files:
    try:
        py_compile.compile(f, doraise=True)
        print(f"  [OK] {f}")
    except py_compile.PyCompileError as e:
        print(f"  [FAIL] {f}: {e}")
        ok = False

print()

# Verify model dir path resolves correctly
sys.path.insert(0, ".")
import importlib.util, pathlib
spec = importlib.util.spec_from_file_location("predictor", "app/services/predictor.py")
mod  = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
model_dir = mod._DEFAULT_MODEL_DIR
print(f"  Model dir: {model_dir}")
print(f"  Exists:    {model_dir.exists()}")

# Check which subfolders have content (= training has been run)
for sub in ["xgboost", "svm", "embedding_lr", "tokenizer", "ensemble"]:
    p = model_dir / sub
    if p.exists():
        files_in = [x.name for x in p.iterdir()]
        print(f"  {sub:15} exists, files: {files_in}")
    else:
        print(f"  {sub:15} MISSING — training not run yet")

print()
print("Syntax check complete —", "ALL OK" if ok else "ERRORS FOUND")
