
# DAFNE Back-End
DAta Flow Network Environment BAck-End

#### Development
You can speed up a development database through Docker with
```bash
docker container run --name dafne_db -p [out-port]:5432 -e POSTGRES_USER=[dafne-user] -e POSTGRES_DB=[dafne-db] -e POSTGRES_PASSWORD=[dafne-pass] -d postgres:12.5
```

Execute the following command in src folder:
```bash
npm install
```
