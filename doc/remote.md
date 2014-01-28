---
title: "Run scripts on remote server"
---
## Run scripts on remote server

You can use ssh to connect to remote server. The following script will login to the remote server ``example.com`` with username ``user``. As soon as login succeeds, it will run the shell script between ``<<SSH`` and ``SSH``.

    ssh user@example.com <<SSH
    cd /srv/my-website
    grunt make
    SSH

It is strongly recommended that you use the Public Key Authentication. If you haven't added your public key in authorized_keys file on remote server, you can free to use the browser terminal, which can be opened in the Jobs page.
