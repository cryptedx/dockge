# Agent Notes

## Standard Live Test Flow

After each commit intended for testing on this branch:

1. Verify the change locally with the smallest relevant checks.
2. Push the branch:

   ```bash
   git push origin master
   ```

3. Deploy to the live test host:

   ```bash
   ssh docker-main 'cd /opt/dockge-custom && git fetch origin master && git checkout master && git pull --ff-only origin master && docker build --target release -t dockge:master -f docker/Dockerfile . && cd /opt/dockge && docker compose up -d'
   ```

4. Push the freshly built image to the Frigate LXC:

   ```bash
   ssh docker-main 'docker save dockge:master | gzip -1' | ssh pve-alt 'pct exec 106 -- sh -c "gunzip | docker load"'
   ```

5. Verify the live container:

   ```bash
   ssh docker-main 'docker ps --filter name=dockge-main --format "{{.Names}} {{.Image}} {{.Status}}" && curl -fsS http://127.0.0.1:5001 >/dev/null'
   ```

6. Verify the Frigate LXC image matches `docker-main`:

   ```bash
   ssh docker-main 'docker image inspect dockge:master --format "{{.Id}}"' && ssh pve-alt 'pct exec 106 -- docker image inspect dockge:master --format "{{.Id}}"'
   ```

If direct SSH to `docker-main` flakes, use the gateway proxy:

```bash
ssh -o ProxyCommand='ssh unifi-cloud-gateway-ultra nc -w 30 192.168.1.9 22' -o HostKeyAlias=docker-main-ip.home.11bit.me marko@docker-main
```
