# Train Moka-v1 on your GPU

From the package root (`moka/`):

```bash
python eval/write_frozen_eval.py
python training/build_train_data.py
python -m pip install -e '.[convert]'
python -m pip install transformers pyyaml
python training/train.py --config training/config.yaml --dry-run
python training/train.py --config training/config.yaml
moka convert checkpoints/moka-v1/final models/moka-v1
```

Do not call the result Laya. Load it with `moka.load("./models/moka-v1")`.
