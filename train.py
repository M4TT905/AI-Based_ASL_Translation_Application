"""
train.py — Train SVM classifier on collected ASL landmark data.

Run from ASL-Backend/:
  python train.py

Output:
  model/asl_svm.pkl     — trained classifier
  model/classes.npy     — class label list
"""

import numpy as np
import os
import pickle
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

DATA_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'training_data')
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'model')
os.makedirs(MODEL_DIR, exist_ok=True)

print('Loading data...')
X       = np.load(os.path.join(DATA_DIR, 'X.npy'))
y       = np.load(os.path.join(DATA_DIR, 'y.npy'))
classes = np.load(os.path.join(DATA_DIR, 'classes.npy'))

print(f'  {X.shape[0]} samples, {X.shape[1]} features, {len(classes)} classes')

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.15, random_state=42, stratify=y
)

print(f'  train: {len(X_train)}  test: {len(X_test)}')

print('Training SVM...')
clf = Pipeline([
    ('scaler', StandardScaler()),
    ('svm',    SVC(kernel='rbf', C=10, gamma='scale', probability=True)),
])
clf.fit(X_train, y_train)

y_pred = clf.predict(X_test)
acc    = accuracy_score(y_test, y_pred)
print(f'\nTest accuracy: {acc*100:.1f}%\n')
print(classification_report(y_test, y_pred, target_names=classes))

print('Saving model...')
with open(os.path.join(MODEL_DIR, 'asl_svm.pkl'), 'wb') as f:
    pickle.dump(clf, f)
np.save(os.path.join(MODEL_DIR, 'classes.npy'), classes)
print('Done — model/asl_svm.pkl')
