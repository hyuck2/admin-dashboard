-- Admin Dashboard Initial Schema
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
USE admin_dashboard;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  department VARCHAR(100) NOT NULL DEFAULT '',
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  password_changed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `groups` (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(500) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_groups (
  user_id INT NOT NULL,
  group_id INT NOT NULL,
  PRIMARY KEY (user_id, group_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('app_deploy', 'page_access') NOT NULL,
  target VARCHAR(100) NOT NULL,
  action ENUM('read', 'write') NOT NULL,
  UNIQUE KEY uq_permission (type, target, action)
);

CREATE TABLE IF NOT EXISTS group_permissions (
  group_id INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (group_id, permission_id),
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (user_id, permission_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(50) NOT NULL,
  menu VARCHAR(50) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_name VARCHAR(200) NOT NULL,
  detail JSON,
  result ENUM('success', 'failed') NOT NULL DEFAULT 'success',
  ip_address VARCHAR(45) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_audit_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_menu ON audit_logs(menu);

-- Phase 3: Server Management
CREATE TABLE IF NOT EXISTS server_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(500) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS servers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hostname VARCHAR(200) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  ssh_port INT NOT NULL DEFAULT 22,
  ssh_username VARCHAR(100) NOT NULL DEFAULT 'root',
  ssh_password_enc VARCHAR(500) NOT NULL DEFAULT '',
  os_info VARCHAR(200) NOT NULL DEFAULT '',
  description VARCHAR(500) NOT NULL DEFAULT '',
  group_id INT,
  status ENUM('unknown','online','offline') NOT NULL DEFAULT 'unknown',
  last_checked_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES server_groups(id) ON DELETE SET NULL,
  UNIQUE KEY uq_server_ip_port (ip_address, ssh_port)
);

CREATE TABLE IF NOT EXISTS metric_sources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  url VARCHAR(500) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ansible_playbooks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL UNIQUE,
  description VARCHAR(500) NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ansible_inventories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  group_id INT,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES server_groups(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ansible_executions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  playbook_id INT NOT NULL,
  inventory_id INT,
  target_type ENUM('group','servers') NOT NULL,
  target_ids JSON NOT NULL,
  status ENUM('running','success','failed','cancelled') NOT NULL DEFAULT 'running',
  started_by INT NOT NULL,
  log TEXT,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME,
  FOREIGN KEY (playbook_id) REFERENCES ansible_playbooks(id) ON DELETE CASCADE,
  FOREIGN KEY (inventory_id) REFERENCES ansible_inventories(id) ON DELETE SET NULL,
  FOREIGN KEY (started_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Seed: permissions
INSERT INTO permissions (type, target, action) VALUES
  ('app_deploy', 'app1', 'write'),
  ('app_deploy', 'app2', 'write'),
  ('page_access', 'apps', 'read'),
  ('page_access', 'users', 'read'),
  ('page_access', 'users', 'write'),
  ('page_access', 'audit', 'read'),
  ('page_access', 'servers', 'read'),
  ('page_access', 'servers', 'write');

-- Seed: admin user (password: admin)
INSERT INTO users (user_id, password_hash, department, role, is_active, password_changed)
VALUES ('admin', '$2b$12$KIXQ8VPnOGDlGmYOA0t3v.nw9mzAUzADfTfrMWIrVLRdT.tMUqzr.', 'IT', 'admin', TRUE, FALSE);

-- Seed: admin group
INSERT INTO `groups` (name, description) VALUES ('관리자', '시스템 관리자 그룹');

-- Seed: admin user -> admin group
INSERT INTO user_groups (user_id, group_id) VALUES (1, 1);

-- Seed: admin group -> all permissions
INSERT INTO group_permissions (group_id, permission_id) VALUES
  (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8);
