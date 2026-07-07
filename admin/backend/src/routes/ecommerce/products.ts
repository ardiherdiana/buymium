import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
import { requireAdmin } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { CreateProductSchema, UpdateProductSchema, ReplaceProductVariantsSchema } from '../../validators/ecommerce'
import { ProductsController } from '../../controllers/ecommerce/products'

const uuidv4 = () => crypto.randomUUID()

const router = Router()

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(process.cwd(), 'uploads')),
    filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('File harus berupa gambar JPG/PNG/WEBP'))
  },
})

// POST /api/admin/products/upload-image - Upload a product photo, returns its relative URL
router.post('/upload-image', requireAdmin, imageUpload.single('image'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'File gambar wajib diunggah' })
    return
  }
  res.status(201).json({ url: `/uploads/${req.file.filename}` })
})

/**
 * @openapi
 * /api/products:
 *   get:
 *     tags: [Products]
 *     summary: List products with pagination
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: sectionId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated product list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     totalPages: { type: integer }
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/admin/products - List products
router.get('/', requireAdmin, ProductsController.index)

// GET /api/admin/products/:id - Get product detail
router.get('/:id', requireAdmin, ProductsController.show)

/**
 * @openapi
 * /api/products:
 *   post:
 *     tags: [Products]
 *     summary: Create a new product
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, price]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               price: { type: number }
 *               sectionId: { type: string }
 *               tags:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       201:
 *         description: Product created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// POST /api/admin/products - Create product
router.post('/', requireAdmin, validate(CreateProductSchema), ProductsController.create)

/**
 * @openapi
 * /api/products/{id}:
 *   patch:
 *     tags: [Products]
 *     summary: Update a product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               price: { type: number }
 *               sectionId: { type: string }
 *               inStock: { type: integer }
 *               isVerified: { type: boolean }
 *               tags:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Product updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// PATCH /api/admin/products/:id - Update product
router.patch('/:id', requireAdmin, validate(UpdateProductSchema), ProductsController.update)

// PUT /api/admin/products/:id/variants - Replace all price variants for a product
router.put('/:id/variants', requireAdmin, validate(ReplaceProductVariantsSchema), ProductsController.replaceVariants)

// DELETE /api/admin/products/:id - Delete product
router.delete('/:id', requireAdmin, ProductsController.destroy)

export default router
