import h5py
import json

model_path = "/Users/matthewhvizdos/CAPSTONE/AI-Based_ASL_Translation_Application/ASL_MediaPipe_Refined/asl_model.h5"

with h5py.File(model_path, "r") as f:
    print("\n=== ROOT KEYS ===")
    print(list(f.keys()))

    print("\n=== MODEL ATTRIBUTES ===")
    for k in f.attrs.keys():
        print(k)

    print("\n=== TRAINING CONFIG ===")
    if "training_config" in f.attrs:
        try:
            config = json.loads(f.attrs["training_config"])
            print(json.dumps(config, indent=2))
        except:
            print("Could not parse training config")

    print("\n=== MODEL CONFIG ===")
    if "model_config" in f.attrs:
        try:
            config = json.loads(f.attrs["model_config"])
            print(json.dumps(config, indent=2)[:2000])
        except:
            print("Could not parse model config")
