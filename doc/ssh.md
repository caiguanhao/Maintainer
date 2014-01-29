---
title: "SSH Configurations"
---
## SSH Configurations

### Public Key Authentication

Usually, your public and private key files, named ``id_rsa.pub`` and ``id_rsa``
respectively, are stored in ``.ssh`` directory under your home directory. If
you don't see the two files in the directory, it means that you haven't created
an SSH key. Use the following command to generate a new SSH key:

    ssh-keygen

Now, you have created the ``id_rsa.pub`` file. On Mac OS X, you can use the
following command to copy its content to clipboard:

    cat ~/.ssh/id_rsa.pub | pbcopy

For other systems, you can open the file in text editor, and copy all contents
to clipboard.

Then log in to remote server. Replace username to your user name, example.com
to your host name or IP address:

    ssh username@example.com

If you haven't created ``.ssh`` directory on server, create one:

    mkdir ~/.ssh

Open the ``vim`` text editor and create an ``authorized_keys`` file:

    vim ~/.ssh/authorized_keys

Now you are in vim editor, press ``i`` to start insert mode. Then paste your
clipboard content in the editor. Then press ``esc`` key to exit insert mode,
press ``ZZ`` (press Shift-Z twice) to save the file and exit the editor.

After that, you may need to set the file permissions. Replace username to
your user name:

    chown -R username:username ~/.ssh
    chmod 700 ~/.ssh
    chmod 600 ~/.ssh/authorized_keys

Now type ``exit`` to log out and use SSH to log in again:

    ssh username@example.com

If you log in to the system without typing password, it means you have
successfully set up the public key authentication.

### Disable Root Login And Password Authentication

Open and edit the SSH daemon configuration file:

    sudo vim /etc/ssh/sshd_config

Lines started with a hash tag (``#``) is treated as comments. If the line
doesn't look like a plain text, it is a configuration option but is not
active. For example, if you want to disable password authentication method,
find the line contains ``PasswordAuthentication``, remove hash tag if any,
and add a ``no`` after it:

    PasswordAuthentication no

Same as above, to disable root login:

    PermitRootLogin no

Press ``esc`` and then ``ZZ`` to save and exit. After that, you need to
restart the SSH daemon to take effect:

    sudo service ssh restart
