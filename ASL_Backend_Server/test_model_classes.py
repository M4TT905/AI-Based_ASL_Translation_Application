import numpy as np
from tensorflow.keras.models import load_model

model = load_model("../ASL_MediaPipe_Refined/asl_model.h5")

active_classes = set()

for i in range(1000):
    fake_input = np.random.rand(1,30,166).astype("float32")
    pred = model.predict(fake_input, verbose=0)
    cls = np.argmax(pred)
    active_classes.add(cls)

print("Classes the model actually outputs:")
print(sorted(active_classes))
print("Total active:", len(active_classes))

