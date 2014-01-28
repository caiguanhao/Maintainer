---
title: "Run scripts on remote server"
---
## Run scripts on remote server

You can use SSH to connect to remote server. The following script will login to
the remote server ``example.com`` with username ``user``. As soon as login
succeeds, it will run the shell script between ``<<SSH`` and ``SSH``.

    ssh user@example.com <<SSH
    cd /srv/my-website
    grunt make
    SSH

It is strongly recommended that you use the Public Key Authentication when
connecting to remote server via SSH. If you haven't added your public key in
authorized_keys file on remote server, you are free to use the browser
terminal to add it. The browser terminal can be opened in the Jobs page.
