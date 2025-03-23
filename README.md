# Madrid Hackathon 2025 - Team 25 (UppEnd) Front End

This component allows users to create a **supply contract on Qubic** by encoding contract details into a transaction payload and broadcasting it to the Qubic network. It dynamically calculates payment and delivery dates, builds a custom payload, signs the transaction, and handles broadcasting with feedback.

The **frontend** component allows users to create a supply contract on Qubic by entering details like name, counterparty ID, amount, and dates. It builds and broadcasts the transaction, displaying real-time status updates.

# Getting Started with Qubic Hackathon Madrid 2025 Demo App


## Getting started

In the project directory, you can run:

### `pnpm install`

Install the web app's dependencies

### `pnpm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `pnpm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

## Prepare Your Web App for Production

### `ssh user@your_server_ip`
Log in to your server via SSH.
Replace user with your SSH `username` and `your_server_ip` with your server’s IP address.

### Install Nginx

```bash
sudo apt update
sudo apt install nginx
```

### Start and enable Nginx

```bash
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Transfer Your Files to the Server

In your server, create the directory that your web app will be stored to
```bash
sudo mkdir -p /var/www/myapp
sudo chown -R www-data:www-data /var/www/myapp
sudo chmod -R 755 /var/www/myapp
```

In your local machine, use either `scp` or `rsync` to securely transfer your app’s files to the server.

```bash
scp -r build/* user@your_server_ip:/var/www/myapp
```

### Configure nginx

```bash
sudo vim /etc/nginx/sites-available/myapp
```

Copy the below configurations, adjust as needed:
```bash
server {
    listen 8081;
    server_name <your_server_ip>;

    root /var/www/myapp;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Enable the configurations

```bash
sudo ln -s /etc/nginx/sites-available/myapp /etc/nginx/sites-enabled/
```
### Test and reload nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Open the app through http://<your_server_ip>:8081

### Conenct to core node server

If you have already launched the node with <node_ip>, try to connect it with our frontend. 
Open the ConnectLink at the top right of the app, select Connect to Server, add your node url:

```bash
http://<node_ip>
```
Then refresh the page

### Troubleshooting
Check Nginx error logs if something goes wrong

```bash
sudo cat /var/log/nginx/error.log
```

