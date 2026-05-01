SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict F42oOmudRqdHitAXMbLcDgUzKBfOGMe6GP5bXdQhZiEUVPufGU8HpbvZ3cRtDe2

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") FROM stdin;
avatars	avatars	\N	2026-03-08 15:56:24.863525+00	2026-03-08 15:56:24.863525+00	t	f	\N	\N	\N	STANDARD
documents	documents	\N	2026-03-19 10:56:10.86881+00	2026-03-19 10:56:10.86881+00	f	f	\N	\N	\N	STANDARD
note-images	note-images	\N	2026-04-03 21:42:13.056353+00	2026-04-03 21:42:13.056353+00	t	f	\N	{image/png,image/jpeg,image/gif,image/webp}	\N	STANDARD
\.


--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."buckets_analytics" ("name", "type", "format", "created_at", "updated_at", "id", "deleted_at") FROM stdin;
\.


--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."buckets_vectors" ("id", "type", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."objects" ("id", "bucket_id", "name", "owner", "created_at", "updated_at", "last_accessed_at", "metadata", "version", "owner_id", "user_metadata") FROM stdin;
12fa219e-556a-4d49-b36a-d77d015095c0	documents	aa652456-d72f-415b-8159-3bd8aa5da13e/1776907467373_requirements-pr.pdf	aa652456-d72f-415b-8159-3bd8aa5da13e	2026-04-23 01:24:28.363415+00	2026-04-23 01:24:28.363415+00	2026-04-23 01:24:28.363415+00	{"eTag": "\\"1630cd35cc389a5869cf812c12efc45d\\"", "size": 137167, "mimetype": "application/pdf", "cacheControl": "max-age=3600", "lastModified": "2026-04-23T01:24:29.000Z", "contentLength": 137167, "httpStatusCode": 200}	01b0f90a-2626-46b4-a3ea-4693513b83b4	aa652456-d72f-415b-8159-3bd8aa5da13e	{}
b5b807d6-a366-4013-9329-d0df8ec90d96	note-images	0fcbc84c-4e9e-47dd-bdb7-1d45789ea877/1777347711121_drawing_1777347710837.png	0fcbc84c-4e9e-47dd-bdb7-1d45789ea877	2026-04-28 03:41:51.478205+00	2026-04-28 03:41:51.478205+00	2026-04-28 03:41:51.478205+00	{"eTag": "\\"60e0b4ecc404c052788ff0713a8ed70a\\"", "size": 21858, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-04-28T03:41:52.000Z", "contentLength": 21858, "httpStatusCode": 200}	3903108c-80e2-47f1-8d5c-9f4aa6052d78	0fcbc84c-4e9e-47dd-bdb7-1d45789ea877	{}
19d4de9b-aab1-45a5-adef-bcb10903a1a4	note-images	e42f5e04-3f78-41b7-ae20-3ce7e2fb4dd3/1777374101604_279600280_170313862095600_3918030402306385609_n.jpg	e42f5e04-3f78-41b7-ae20-3ce7e2fb4dd3	2026-04-28 11:01:42.483456+00	2026-04-28 11:01:42.483456+00	2026-04-28 11:01:42.483456+00	{"eTag": "\\"719ed1b59442adaf39a4b41d0933da51\\"", "size": 96750, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-28T11:01:43.000Z", "contentLength": 96750, "httpStatusCode": 200}	b3ced831-10ce-4891-8241-035c4dd7863b	e42f5e04-3f78-41b7-ae20-3ce7e2fb4dd3	{}
67e5ac6a-98af-4b86-acc0-1f2c498ea2fe	documents	aa652456-d72f-415b-8159-3bd8aa5da13e/1777374240738_requirements-pr_summarized.pdf	aa652456-d72f-415b-8159-3bd8aa5da13e	2026-04-28 11:04:01.533715+00	2026-04-28 11:04:01.533715+00	2026-04-28 11:04:01.533715+00	{"eTag": "\\"b4ef566d9db02e28b08b4fde67b8b06c\\"", "size": 13370, "mimetype": "application/pdf", "cacheControl": "max-age=3600", "lastModified": "2026-04-28T11:04:02.000Z", "contentLength": 13370, "httpStatusCode": 200}	4b1b4c35-0a31-47c2-828a-a566c0579626	aa652456-d72f-415b-8159-3bd8aa5da13e	{}
6bcb3bc0-e93b-490b-b0b9-e265fd0e5d64	avatars	e42f5e04-3f78-41b7-ae20-3ce7e2fb4dd3/avatar.jpg	e42f5e04-3f78-41b7-ae20-3ce7e2fb4dd3	2026-04-19 21:35:21.718036+00	2026-04-19 21:35:21.718036+00	2026-04-19 21:35:21.718036+00	{"eTag": "\\"719ed1b59442adaf39a4b41d0933da51\\"", "size": 96750, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-19T21:35:22.000Z", "contentLength": 96750, "httpStatusCode": 200}	5d9b6ae2-c023-4c38-aaef-e6f2dc3c5e28	e42f5e04-3f78-41b7-ae20-3ce7e2fb4dd3	{}
0f04bd82-97ec-432b-9731-f7aff2d56b11	documents	e42f5e04-3f78-41b7-ae20-3ce7e2fb4dd3/1777132095663_Itinerary2.pdf	e42f5e04-3f78-41b7-ae20-3ce7e2fb4dd3	2026-04-25 15:48:15.749322+00	2026-04-25 15:48:15.749322+00	2026-04-25 15:48:15.749322+00	{"eTag": "\\"66943691679637a8e6d728c4d188b5f9\\"", "size": 204996, "mimetype": "application/pdf", "cacheControl": "max-age=3600", "lastModified": "2026-04-25T15:48:16.000Z", "contentLength": 204996, "httpStatusCode": 200}	3b85ba68-6cba-4cba-8635-d1baf517b4ca	e42f5e04-3f78-41b7-ae20-3ce7e2fb4dd3	{}
27c9eac5-96fc-41aa-b953-8d9e645b6cbd	documents	e42f5e04-3f78-41b7-ae20-3ce7e2fb4dd3/1777254171759_image.jpeg	e42f5e04-3f78-41b7-ae20-3ce7e2fb4dd3	2026-04-27 01:42:52.552195+00	2026-04-27 01:42:52.552195+00	2026-04-27 01:42:52.552195+00	{"eTag": "\\"20be12929ee01c16b87ff32789784719\\"", "size": 54783, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-27T01:42:53.000Z", "contentLength": 54783, "httpStatusCode": 200}	36ee5819-7735-43dd-b286-59c381fc042e	e42f5e04-3f78-41b7-ae20-3ce7e2fb4dd3	{}
\.


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."s3_multipart_uploads" ("id", "in_progress_size", "upload_signature", "bucket_id", "key", "version", "owner_id", "created_at", "user_metadata", "metadata") FROM stdin;
\.


--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."s3_multipart_uploads_parts" ("id", "upload_id", "size", "part_number", "bucket_id", "key", "etag", "owner_id", "version", "created_at") FROM stdin;
\.


--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."vector_indexes" ("id", "name", "bucket_id", "data_type", "dimension", "distance_metric", "metadata_configuration", "created_at", "updated_at") FROM stdin;
\.


--
-- PostgreSQL database dump complete
--

-- \unrestrict F42oOmudRqdHitAXMbLcDgUzKBfOGMe6GP5bXdQhZiEUVPufGU8HpbvZ3cRtDe2

RESET ALL;
