const express = require('express');
const { authenticate, requireScope } = require('../middleware/auth');
const { notFound, conflict, badRequest } = require('../errors');

const UNIQUE_VIOLATION = '23505';

module.exports = function rolesRouter({ db }) {
  const router = express.Router();
  router.use(authenticate);

  router.post('/users/:userId/roles', requireScope('roles:write'), async (req, res, next) => {
    try {
      const { roleId } = req.body || {};
      if (typeof roleId !== 'string' || !/^[a-z][a-z0-9_-]{2,63}$/.test(roleId)) {
        throw badRequest([{ field: 'roleId', problem: 'must be a role slug' }]);
      }

      const user = await db.query('SELECT id FROM users WHERE id = $1', [req.params.userId]);
      if (user.rowCount === 0) throw notFound('User');

      const role = await db.query('SELECT id FROM roles WHERE slug = $1', [roleId]);
      if (role.rowCount === 0) throw notFound('Role');

      try {
        await db.query(
          'INSERT INTO user_roles (user_id, role_id, granted_by) VALUES ($1, $2, $3)',
          [req.params.userId, role.rows[0].id, req.principal.sub]
        );
      } catch (err) {
        if (err.code === UNIQUE_VIOLATION) throw conflict('User already has this role');
        throw err;
      }

      res.status(201).location(`/users/${req.params.userId}/roles/${roleId}`).json({ userId: req.params.userId, roleId });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/users/:userId/roles/:roleId', requireScope('roles:write'), async (req, res, next) => {
    try {
      const result = await db.query(
        `DELETE FROM user_roles ur USING roles r
          WHERE ur.role_id = r.id AND r.slug = $2 AND ur.user_id = $1`,
        [req.params.userId, req.params.roleId]
      );
      if (result.rowCount === 0) throw notFound('Role assignment');
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.get('/users/:userId/roles', requireScope('roles:read'), async (req, res, next) => {
    try {
      const { rows } = await db.query(
        `SELECT r.slug AS "roleId", ur.granted_by AS "grantedBy"
           FROM user_roles ur JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = $1 ORDER BY r.slug`,
        [req.params.userId]
      );
      res.status(200).json({ roles: rows });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
